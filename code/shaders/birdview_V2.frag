#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D u_tex0;
uniform vec2 u_resolution;

vec2 fisheye_undistortion(vec4 k,mat3 K,float scale,vec2 shift,vec2 coord, float ratio){//k:distortion coefficients; K:intrinsic matrix
    K[0][0]*=ratio;
    K[1][1]*=ratio;
    K[2][0]*=ratio;
    K[2][1]*=ratio;
    float
    fx_inv=1./(K[0][0]*scale),
    fy_inv=1./(K[1][1]*scale),
    cx_inv=-(K[2][0]+shift.x)/K[0][0],
    cy_inv=-(K[2][1]+shift.y)/K[1][1];
    mat3 K_inv=mat3(fx_inv,0.,0.,0.,fy_inv,0.,cx_inv,cy_inv,1.); // col major
    
    float
    i=coord.y,//row number
    j=coord.x,//col number
    _x=i*K_inv[1][0]+j*K_inv[0][0]+K_inv[2][0],
    _y=i*K_inv[1][1]+j*K_inv[0][1]+K_inv[2][1],
    _w=i*K_inv[1][2]+j*K_inv[0][2]+K_inv[2][2];
    
    float
    x=_x/_w,y=_y/_w,
    r=sqrt(x*x+y*y),
    theta=atan(r),
    theta2=theta*theta,
    theta4=theta2*theta2,
    theta6=theta2*theta4,
    theta8=theta4*theta4,
    r_d=theta*(1.+k[0]*theta2+k[1]*theta4+k[2]*theta6+k[3]*theta8),
    r_scale=r_d/r; // if r=0 then r_scale=1. Ignore this rare case for performance reason
    
    float
    u=K[0][0]*x*r_scale+K[2][0],
    v=K[1][1]*y*r_scale+K[2][1];
    // Here in undistortion, size(OutputImg)=size(InputImg), meaning max(u)=u_resolution.x, max(y)=u_resolution.y.
    // It's because the input coord here were gotten from homography_transformation(), ranging from vec2(0)~u_resolution*ratio. (since H_inv has got modified w/ ratio)
    // u&v will be normalized to [0,1], thus ignoring the image size and can be used to retrieve color from the original image.
    return vec2(u,v); 
}

vec2 homography_transformation(mat3 H_inv,vec2 coord,float ratio){
    vec3
    dst=vec3(coord,1.),
    src=H_inv*dst,
    src_normalized=src/src.z;
    return src_normalized.xy*ratio; // since H was defined as [W,H]->[W/2,H/2]
}

float cropping(vec4 cropRange,float ratio){ // cropRange.y is under image coordinate system
    float
    x=cropRange.x*ratio,
    y=cropRange.y*ratio,
    w=cropRange.z*ratio,
    h=cropRange.w*ratio,
    withinRange=step(x,gl_FragCoord.x)*(1.-step(x+w,gl_FragCoord.x))
                  *step(y,gl_FragCoord.y)*step(u_resolution.y-(y+h),gl_FragCoord.y);
    return withinRange;
}

// Wrapper: undistortion + homography + cropping
vec2 birdView(vec4 k,mat3 K,float scale,vec2 shift,mat3 H_inv,float ratio,vec2 coord, vec4 cropRange){
    vec2 resultCoord=homography_transformation(H_inv,coord,ratio); // coord in undistorted
    resultCoord=fisheye_undistortion(k,K,scale,shift,resultCoord, ratio); // coord in original
    float homographyWithinRange=step(0., resultCoord.x)*(1.-step(u_resolution.x,resultCoord.x))
                               *step(0., resultCoord.y)*(1.-step(u_resolution.y,resultCoord.y));
    float croppingWithinRange=cropping(cropRange, ratio);
    // return resultCoord;
    return resultCoord*homographyWithinRange*croppingWithinRange;
}



void main(){
    float ratio=u_resolution.x/1920.; // ratio = window_resolution / original_image_size
    /// Calibration parameters
    float fx=5.21403992e+02,fy=5.18772705e+02,cx=9.48270508e+02,cy=5.42287170e+02;
    vec4 distortionCoefficients=vec4(-2.4805685241549125e-02,-1.2937205339701639e-02,7.5466588447294022e-03,-3.5348453554973126e-03);
    mat3 intrinsicMatrix=mat3(fx,0.,0.,0.,fy,0,cx,cy,1.);//colomn major
    // Undistortion parameters
    float scale=0.5;vec2 shift=vec2(u_resolution.x*0.5,u_resolution.y*0.5);
    
    /// Homography transformation
    /* 
    /!\ H is culculated with points under the gl_FragCoord's coordinate system, which means that for all the points (in both code & dst imgs) used to calculate M,
    their y*=-1, y+=imgHeight. Then the inverse of M is used to find out where the current pixel's color is originated. /!\ 
    /!\ Also, the coordinates of the source points used to get H are from the original sized image, without shrinkage. /!\  */
    mat3 H_inv=mat3(6.47099220213213,.352476689179285,.000922713846019077,
                    17.6105264345445,12.7053779308605,.0185329623342456,
                    -15850.6187148092,-11107.1665175717,-15.2327941820516);
    H_inv[0]/=ratio;
    H_inv[1]/=ratio; //M for [src_points -> dst_points*ratio].

    /// Crop range (under image coordinate system)
    vec4 cropRange=vec4(0,0,470,200);

    /// original (distorted) -> undistorted -> birdview (result))
    vec2 resultCoord=birdView(distortionCoefficients, intrinsicMatrix, scale, shift, H_inv, ratio, gl_FragCoord.xy, cropRange);


    vec2 textureCoord=resultCoord/u_resolution;
    gl_FragColor=texture2D(u_tex0,textureCoord);
    
}

/// ================ Visualization using glslViewer ================
//  ratio=0.25
//  glslViewer undistortion_opencv.frag front.jpg -l -w 480 -h 270
//  ratio=0.5
//  glslViewer undistortion_opencv.frag front.jpg -l -w 960 -h 540
//  ratio=1
//  glslViewer undistortion_opencv.frag front.jpg -l -w 1920 -h 1080
