#ifndef PARAMETERS_H
#define PARAMETERS_H

#include <tuple>
#include <Eigen/LU>
#include "yaml.h"

using namespace std;

struct Parameters {
    float ratio;
    float resolution[2]{};
    float intrinsicMatrices[6][9]{};
    float distortionCoefficients[6][4]{};
    float undistortionScaleShift[6][3]{};
    float featurePoints[6][8]{};
    float dstPoints[6][8]{};
    Eigen::Matrix<float, 3, 3, Eigen::RowMajor> homographyMatrices[6]{};
    float layout_vehicle[4]{};
    float layout_canvas[2]{};
    float layout_flankBlendingAreas[2]{};


    explicit Parameters(string &&yamlFile);

    void setShaderUniforms(Gloom::Shader &myShader);
};

Parameters::Parameters(string &&yamlFile) {
    try {
        YAML::Node config = YAML::LoadFile(yamlFile);

        // Ratio & Resolution
        ratio = config["ratio"].as<float>();
        auto resolution_vec = config["resolution"].as<vector<float>>();
        copy(resolution_vec.begin(), resolution_vec.end(), resolution);

        map<string, int> cams{{"front",      0},
                              {"leftfront",  1},
                              {"leftback",   2},
                              {"rightfront", 3},
                              {"rightback",  4},
                              {"back",       5}};
        for (const auto &[name, idx]: cams) {
            // Intrinsic matrices
            auto intrinsicMatrix_vec = config["intrinsicMatrices"][name].as<vector<float>>();
            copy(intrinsicMatrix_vec.begin(), intrinsicMatrix_vec.end(), intrinsicMatrices[idx]);
            // Distortion coefficients
            auto distCoeffs_vec = config["distortionCoefficients"][name].as<vector<float>>();
            copy(distCoeffs_vec.begin(), distCoeffs_vec.end(), distortionCoefficients[idx]);
            // Homography matrices
//            auto homography_vec = config["homographyMatrices"][name].as<vector<float>>();
//            copy(homography_vec.begin(), homography_vec.end(), homographyMatrices[idx]);
            // Undistortion scales & shifts
            auto undistortionScaleShift_vec = config["undistortionScaleShift"][name].as<vector<float>>();
            undistortionScaleShift_vec[1] *= ratio;
            undistortionScaleShift_vec[2] *= ratio; // scale the shifts according to ratio
            copy(undistortionScaleShift_vec.begin(), undistortionScaleShift_vec.end(), undistortionScaleShift[idx]);
            // Feature & dst points
            auto featurePoints_vec = config["featurePoints"][name].as<vector<float>>();
            copy(featurePoints_vec.begin(), featurePoints_vec.end(), featurePoints[idx]);
            auto dstPoints_vec = config["dstPoints"][name].as<vector<float>>();
            copy(dstPoints_vec.begin(), dstPoints_vec.end(), dstPoints[idx]);
        }
        // Layout parameters
        layout_vehicle[0] = config["layout"]["vehicle"]["x1"].as<float>();
        layout_vehicle[1] = config["layout"]["vehicle"]["x2"].as<float>();
        layout_vehicle[2] = config["layout"]["vehicle"]["y1"].as<float>();
        layout_vehicle[3] = config["layout"]["vehicle"]["y2"].as<float>();
        layout_canvas[0] = config["layout"]["canvas"]["x3"].as<float>();
        layout_canvas[1] = config["layout"]["canvas"]["y3"].as<float>();
        layout_flankBlendingAreas[0] = config["layout"]["flankBlendingAreas"]["y4"].as<float>();
        layout_flankBlendingAreas[1] = config["layout"]["flankBlendingAreas"]["y5"].as<float>();
    }
    catch (const YAML::BadFile &e) {
        cerr << e.msg << endl;
    }
    catch (const YAML::ParserException &e) {
        cerr << e.msg << endl;
    }
}

void Parameters::setShaderUniforms(Gloom::Shader &myShader) {
    /// Generic: Resolution & Ratio
    GLint uniformLocation = glGetUniformLocation(myShader.get(), "u_resolution");
    resolution[0] *= ratio;
    resolution[1] *= ratio;
    glUniform2fv(uniformLocation, 1, resolution);
    uniformLocation = glGetUniformLocation(myShader.get(), "u_ratio");
    glUniform1f(uniformLocation, ratio);

    /// Layout
    auto setShaderUniform1f = [&uniformLocation, &myShader](string &&name, float value) -> void {
        uniformLocation = glGetUniformLocation(myShader.get(), name.c_str());
        glUniform1f(uniformLocation, value);
    };
    setShaderUniform1f("u_x1", layout_vehicle[0]);
    setShaderUniform1f("u_x2", layout_vehicle[1]);
    setShaderUniform1f("u_y1", layout_vehicle[2]);
    setShaderUniform1f("u_y2", layout_vehicle[3]);
    setShaderUniform1f("u_x3", layout_canvas[0]);
    setShaderUniform1f("u_y3", layout_canvas[1]);
    setShaderUniform1f("u_y4", layout_flankBlendingAreas[0]);
    setShaderUniform1f("u_y5", layout_flankBlendingAreas[1]);

    /// Individual parameters for each camera
    // Lambda: Calculate homography matrices
    /*  Homography matrices H
    /!\ H in the shader should be calculated with points under gl_FragCoord's coordinate system.
    However, the point coordinates are with respect to the image coordinate system. So for all the points (both code & dst points) used,
    their y=imgHeight-y. Then the inverse of H is used to find out where the current pixel's color should be originated. /!\
    /!\ Also, the coordinates of the source points used to get H are from the original sized images, without shrinking. /!\
    */
    auto calculateHomographyMatrix = [this](float srcPts[8], float dstPts[8]) {
        for (int i = 0; i < 4; ++i) { // Coordinate system conversion: image -> gl_FragCoord
            srcPts[2 * i + 1] = resolution[1] / ratio - srcPts[2 * i + 1];
            dstPts[2 * i + 1] = resolution[1] / ratio - dstPts[2 * i + 1];
        }
        Eigen::Matrix<float, 4, 2, Eigen::RowMajor> src(srcPts), dst(dstPts);
        Eigen::Matrix<float, 8, 8, Eigen::RowMajor> A;
        Eigen::Matrix<float, 8, 1> b, x;
        for (int i = 0; i < 4; ++i) {
            A.row(i * 2) << src(i, 0), src(i, 1), 1, 0, 0, 0, -src(i, 0) * dst(i, 0), -src(i, 1) * dst(i, 0);
            A.row(i * 2 + 1) << 0, 0, 0, src(i, 0), src(i, 1), 1, -src(i, 0) * dst(i, 1), -src(i, 1) * dst(i, 1);
            b.row(i * 2) << dst(i, 0);
            b.row(i * 2 + 1) << dst(i, 1);
        }
        x = A.inverse() * b;
        Eigen::Matrix<float, 3, 3, Eigen::RowMajor> H(x.data());
        H(2, 2) = 1;
        return H;
    };
    map<string, int> cams{{"Front",      0},
                          {"LeftFront",  1},
                          {"LeftBack",   2},
                          {"RightFront", 3},
                          {"RightBack",  4},
                          {"Back",       5}};
    string uniformVarName;
    for (const auto &[name, idx]: cams) {
        // Intrinsic Matrices
        uniformVarName = "u_intrinsics" + name;
        uniformLocation = glGetUniformLocation(myShader.get(), uniformVarName.c_str());
        glUniformMatrix3fv(uniformLocation, 1, true, intrinsicMatrices[idx]); // transpose: true
        // Distortion coefficients
        uniformVarName = "u_distCoeffs" + name;
        uniformLocation = glGetUniformLocation(myShader.get(), uniformVarName.c_str());
        glUniform4fv(uniformLocation, 1, distortionCoefficients[idx]);
        // Inverse homography matrix
        homographyMatrices[idx] = calculateHomographyMatrix(featurePoints[idx], dstPoints[idx]);
        Eigen::Matrix homographyMatrixInverse = homographyMatrices[idx].inverse().eval();
        uniformVarName = "u_H_inv" + name;
        uniformLocation = glGetUniformLocation(myShader.get(), uniformVarName.c_str());
        glUniformMatrix3fv(uniformLocation, 1, true, homographyMatrixInverse.data()); // transpose: true
        // Scales
        uniformVarName = "u_scale" + name;
        uniformLocation = glGetUniformLocation(myShader.get(), uniformVarName.c_str());
        glUniform1f(uniformLocation, undistortionScaleShift[idx][0]);
        // Shifts
        uniformVarName = "u_shift" + name;
        uniformLocation = glGetUniformLocation(myShader.get(), uniformVarName.c_str());
        glUniform2fv(uniformLocation, 1, undistortionScaleShift[idx] + 1);
    }
}

#endif
