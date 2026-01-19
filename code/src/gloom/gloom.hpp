// Preprocessor directives
#ifndef GLOOM_HPP
#define GLOOM_HPP
#pragma once

// System Headers
#include <glad/glad.h>

// Standard headers
#include <string>

// Constants
const float       windowScalingFactor   = 1;
const int         windowWidth           = int(1920 * windowScalingFactor);
const int         windowHeight          = int(1080 * windowScalingFactor);
const std::string windowTitle           = "OpenGL";
const GLint       windowResizable       = GL_FALSE;
const int         windowSamples         = 4;

#endif
