#ifdef GL_ES
precision mediump float;
 #endif

// Generic uniform variables
uniform vec2        u_resolution;// resized image size = original_image_size * u_ratio
uniform float       u_ratio;// = u_resolution / original_image_size
// Textures
uniform sampler2D   u_texFront;
uniform sampler2D   u_texLeftFront;
uniform sampler2D   u_texLeftBack;
uniform sampler2D   u_texRightFront;
uniform sampler2D   u_texRightBack;
uniform sampler2D   u_texBack;
// Blending masks
uniform sampler2D   u_maskTopLeft;
uniform sampler2D   u_maskTopRight;
uniform sampler2D   u_maskBtmLeft;
uniform sampler2D   u_maskBtmRight;
uniform sampler2D   u_maskSides;
// Intrinsic matrices
uniform mat3        u_intrinsicsFront;
uniform mat3        u_intrinsicsLeftFront;
uniform mat3        u_intrinsicsLeftBack;
uniform mat3        u_intrinsicsRightFront;
uniform mat3        u_intrinsicsRightBack;
uniform mat3        u_intrinsicsBack;
// Distortion coefficients
uniform vec4        u_distCoeffsFront;
uniform vec4        u_distCoeffsLeftFront;
uniform vec4        u_distCoeffsLeftBack;
uniform vec4        u_distCoeffsRightFront;
uniform vec4        u_distCoeffsRightBack;
uniform vec4        u_distCoeffsBack;
// Scales & Shifts
uniform float       u_scaleFront;
uniform float       u_scaleLeftFront;
uniform float       u_scaleLeftBack;
uniform float       u_scaleRightFront;
uniform float       u_scaleRightBack;
uniform float       u_scaleBack;
uniform vec2        u_shiftFront;
uniform vec2        u_shiftLeftFront;
uniform vec2        u_shiftLeftBack;
uniform vec2        u_shiftRightFront;
uniform vec2        u_shiftRightBack;
uniform vec2        u_shiftBack;

// Layout
uniform float       u_x1,u_x2,u_x3,u_y1,u_y2,u_y3,u_y4,u_y5;

// Homography matrices
uniform mat3        u_H_invFront;
uniform mat3        u_H_invLeftFront;
uniform mat3        u_H_invLeftBack;
uniform mat3        u_H_invRightFront;
uniform mat3        u_H_invRightBack;
uniform mat3        u_H_invBack;

vec2 fisheye_undistortion(vec4 k, mat3 K, float scale, vec2 shift, vec2 coord){ //k:distortion coefficients; K:intrinsic matrix
    K[0][0]*=u_ratio;
    K[1][1]*=u_ratio;
    K[2][0]*=u_ratio;
    K[2][1]=u_resolution.y/u_ratio-K[2][1]; // transform c_y of K to the texture coordinate system
    K[2][1]*=u_ratio;
    float
    fx_inv=1./(K[0][0]*scale),
    fy_inv=1./(K[1][1]*scale),
    cx_inv=-(K[2][0]+u_resolution.x/2.-shift.x)/K[0][0],
    cy_inv=-(K[2][1]+u_resolution.y/2.-shift.y)/K[1][1];
    mat3 K_inv=mat3(fx_inv, 0., 0., 0., fy_inv, 0., cx_inv, cy_inv, 1.);// col major

    float
    i=coord.y, //row number
    j=coord.x, //col number
    _x=i*K_inv[1][0]+j*K_inv[0][0]+K_inv[2][0],
    _y=i*K_inv[1][1]+j*K_inv[0][1]+K_inv[2][1],
    _w=i*K_inv[1][2]+j*K_inv[0][2]+K_inv[2][2];

    float
    x=_x/_w, y=_y/_w,
    r=sqrt(x*x+y*y),
    theta=atan(r),
    theta2=theta*theta,
    theta4=theta2*theta2,
    theta6=theta2*theta4,
    theta8=theta4*theta4,
    r_d=theta*(1.+k[0]*theta2+k[1]*theta4+k[2]*theta6+k[3]*theta8),
    r_scale=r_d/r;// if r=0 then r_scale=1. Ignore this rare case for performance reason

    float
    u=K[0][0]*x*r_scale+K[2][0],
    v=K[1][1]*y*r_scale+K[2][1];
    // Here in undistortion, size(OutputImg)=size(InputImg), meaning max(u)=u_resolution.x, max(y)=u_resolution.y.
    // It's because the input coord here were gotten from homography_transformation(), ranging from vec2(0)~u_resolution*ratio. (since H_inv has got modified w/ ratio)
    // u&v will be normalized to [0,1], thus ignoring the image size and can be used to retrieve color from the original image.
    return vec2(u, v);
}

vec2 homography_transformation(mat3 H_inv, vec2 coord){
    H_inv[0]/=u_ratio;
    H_inv[1]/=u_ratio;//M for [src_points -> dst_points*ratio].
    vec3
    dst=vec3(coord, 1.),
    src=H_inv*dst,
    src_normalized=src/src.z;
    return src_normalized.xy*u_ratio;// since H was defined as [W,H]->[W/2,H/2]
}

float cropping(vec4 cropRange){ // cropRange is defined for original size, and cropRange.y is under image coordinate system
    float
    x=cropRange.x*u_ratio,
    y=cropRange.y*u_ratio,
    w=cropRange.z*u_ratio,
    h=cropRange.w*u_ratio,
    withinRange=step(x, gl_FragCoord.x)*(1.-step(x+w, gl_FragCoord.x))*
                (1.-step(u_resolution.y-y, gl_FragCoord.y))*step(u_resolution.y-y-h, gl_FragCoord.y);
    return withinRange;
}

// Wrapper: undistortion + homography + cropping
vec4 birdView(vec4 k, mat3 K, float scale, vec2 shift, mat3 H_inv, vec4 cropRange, sampler2D texture){
    vec2
    coord=gl_FragCoord.xy,
    coordInUndistorted=homography_transformation(H_inv, coord),// coord in undistorted
    coordInTex=fisheye_undistortion(k, K, scale, shift, coordInUndistorted);// coord in original
    vec4 color=texture2D(texture, coordInTex/u_resolution);
    float
    homographyWithinRange=step(0., coordInTex.x)*(1.-step(u_resolution.x, coordInTex.x))
                                *step(0., coordInTex.y)*(1.-step(u_resolution.y, coordInTex.y)),
    croppingWithinRange=cropping(cropRange);
//    croppingWithinRange = 1.;// no cropping
//    return color;
    return color*homographyWithinRange*croppingWithinRange;
}

vec4 blending(vec4 blendingRegion, sampler2D mask, vec4 color1, vec4 color2, bool maskInverse){ // blendingRegion is defined on orignal size
    vec2 coord=gl_FragCoord.xy/u_ratio;
    coord.y-=u_resolution.y/u_ratio-blendingRegion.w; // mask at the top right corner
    coord.x-=blendingRegion.x;
    coord.y+=blendingRegion.y;
    vec2 maskCoordNormalized = coord / blendingRegion.zw;
    vec4 maskValue = texture2D(mask, maskCoordNormalized);
    // within blendingRegion: weight=maskValue; out of the region: weight=1
    float
    inBlendingRegion=cropping(blendingRegion),
    weight1 = inBlendingRegion * (maskInverse==true?1.-maskValue.x:maskValue.x),
    weight2 = inBlendingRegion * (1.-weight1);
    vec3 color=color1.rgb*weight1 + color2.rgb*weight2;
    return vec4(color,1);
}

void main(){
    /// ===================================== Layout ========================================
    // Overall regions
    vec4 // vec4(topLeftCorner.x, topLeftCorner.y, width, height) to delimit a region
    overallRegionFront=vec4(0,0,u_x3,u_y1),
    overallRegionLeftFront=vec4(0,0,u_x1,u_y5),
    overallRegionLeftBack=vec4(0,u_y4,u_x1,u_y3-u_y4),
    overallRegionRightFront=vec4(u_x2,0,u_x3-u_x2,u_y5),
    overallRegionRightBack=vec4(u_x2,u_y4,u_x3-u_x2,u_y3-u_y4),
    overallRegionBack=vec4(0,u_y2,u_x3,u_y3-u_y2),
    // Blending regions
    topLeftCorner=vec4(0,0,u_x1,u_y1),
    topRightCorner=vec4(u_x2,0,u_x3-u_x2,u_y1),
    btmLeftCorner=vec4(0,u_y2,u_x1,u_y3-u_y2),
    btmRightCorner=vec4(u_x2,u_y2,u_x3-u_x2,u_y3-u_y2),
    leftBlendingRegion=vec4(0,u_y4,u_x1,u_y5-u_y4),
    rightBlendingRegion=vec4(u_x2,u_y4,u_x1,u_y5-u_y4),
    // Exclusive regions
    exclusiveFront=vec4(u_x1,0,u_x2-u_x1,u_y1),
    exclusiveLeftFront=vec4(0,u_y1,u_x1,u_y4-u_y1),
    exclucsiveLeftBack=vec4(0,u_y5,u_x1,u_y2-u_y5),
    exclusiveRightFront=vec4(u_x2,u_y1,u_x3-u_x2,u_y4-u_y1),
    exclusiveRightBack=vec4(u_x2,u_y5,u_x3-u_x2,u_y2-u_y5),
    exclusiveBack=vec4(u_x1,u_y2,u_x2-u_x1,u_y3-u_y2);

    /// ===================================== Transform =====================================
    vec4
    colorFront=birdView(u_distCoeffsFront, u_intrinsicsFront, u_scaleFront, u_shiftFront, u_H_invFront, overallRegionFront, u_texFront),
    colorLeftFront=birdView(u_distCoeffsLeftFront, u_intrinsicsLeftFront, u_scaleLeftFront, u_shiftLeftFront, u_H_invLeftFront, overallRegionLeftFront, u_texLeftFront),
    colorLeftBack=birdView(u_distCoeffsLeftBack, u_intrinsicsLeftBack, u_scaleLeftBack, u_shiftLeftBack, u_H_invLeftBack, overallRegionLeftBack, u_texLeftBack),
    colorRightFront=birdView(u_distCoeffsRightFront, u_intrinsicsRightFront, u_scaleRightFront, u_shiftRightFront, u_H_invRightFront, overallRegionRightFront, u_texRightFront),
    colorRightBack=birdView(u_distCoeffsRightBack, u_intrinsicsRightBack, u_scaleRightBack, u_shiftRightBack, u_H_invRightBack, overallRegionRightBack, u_texRightBack),
    colorBack=birdView(u_distCoeffsBack, u_intrinsicsBack, u_scaleBack, u_shiftBack, u_H_invBack, overallRegionBack, u_texBack);
//    gl_FragColor=colorLeftFront;

//    vec2 coordInTex=fisheye_undistortion(u_distCoeffsRightBack, u_intrinsicsRightBack, u_scaleRightBack, u_shiftRightBack, gl_FragCoord.xy);
//    gl_FragColor=texture2D(u_texRightBack, coordInTex/u_resolution);

    /// ===================================== Blending ======================================
    gl_FragColor =
    // blending regions (4 corners)
    blending(topLeftCorner, u_maskTopLeft, colorFront, colorLeftFront, false) + blending(topRightCorner, u_maskTopRight, colorFront, colorRightFront, false) +
    blending(btmLeftCorner, u_maskBtmLeft, colorBack, colorLeftBack, false) + blending(btmRightCorner, u_maskBtmRight, colorBack, colorRightBack, false) +
    blending(leftBlendingRegion, u_maskSides, colorLeftFront, colorLeftBack, false) + blending(rightBlendingRegion, u_maskSides, colorRightFront, colorRightBack, false) +
    // exclusive regions
    cropping(exclusiveFront)*colorFront + cropping(exclusiveBack)*colorBack +
    cropping(exclusiveLeftFront)*colorLeftFront + cropping(exclucsiveLeftBack)*colorLeftBack +
    cropping(exclusiveRightFront)*colorRightFront + cropping(exclusiveRightBack)*colorRightBack
    ;
}
