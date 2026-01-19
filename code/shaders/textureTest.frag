#version 330 core

uniform vec2 u_resolution;
uniform sampler2D u_maskFront;

void main()
{
    gl_FragColor = texture2D(u_maskFront, gl_FragCoord.xy/u_resolution);
}
