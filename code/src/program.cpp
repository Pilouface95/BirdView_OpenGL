// Local headers
#include "program.hpp"
#include "gloom/gloom.hpp"
#include "gloom/shader.hpp"
#include <iostream>
#include <filesystem>

#define STB_IMAGE_IMPLEMENTATION

#include "stb_image.h"
#include "parameters.hpp"

using namespace std;

void runProgram(GLFWwindow *window) {
//     glViewport(100, -10, 960, 540);

    // Enable depth (Z) buffer (accept "closest" fragment)
    glEnable(GL_DEPTH_TEST);
    glDepthFunc(GL_LESS);
    // Configure miscellaneous OpenGL settings
    glEnable(GL_CULL_FACE);
    // Set up the shader
    Gloom::Shader myShader;
    filesystem::path shaderDir("/home/lead/Documents/Code/C++/OpenGL/OpenGL_BirdView/code/shaders");

    if (!exists(shaderDir))
        cerr << "Invalid shader path. Please correctly set \"shaderDir\" variable." << endl;
    filesystem::path vertPath = shaderDir / "textureTest.vert";
    filesystem::path fragPath = shaderDir / "birdview_V3.frag";
//    filesystem::path fragPath = shaderDir / "textureTest.frag"; // show an image as it is
    myShader.makeBasicShader(vertPath, fragPath);
    myShader.activate();

    // =================== Set up your scene here (create Vertex Array Objects, etc.) ====================
    // [Lambda] Set textures
    auto setShaderTexture = [&myShader](unsigned int textures[6], int idx, int texOffset, const string &uniformName,
                                        string &&texFile) -> void { // idx: index of the array. texOffset: texture offset in shader program
        glGenTextures(1, textures + idx);
        glActiveTexture(GL_TEXTURE0 +
                        texOffset); // glBindTexture now affect this texture. Allows for binding multiple textures
        glBindTexture(GL_TEXTURE_2D,
                      textures[idx]); // all upcoming GL_TEXTURE_2D operations now have effect on this texture object
        // set the texture wrapping parameters
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S,
                        GL_REPEAT); // set texture wrapping to GL_REPEAT (default method)
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
        // set texture filtering parameters
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        // load image, create texture and generate mipmaps
        int width, height, nrChannels;
        stbi_set_flip_vertically_on_load(true);
        unsigned char *img = stbi_load(texFile.c_str(), &width,
                                       &height, &nrChannels, 0);
        if (img) {
            glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, img);
            glGenerateMipmap(GL_TEXTURE_2D);
        } else
            std::cout << "Failed to load texture" << std::endl;
        stbi_image_free(img);
        // set uniform
        glUniform1i(glGetUniformLocation(myShader.get(), uniformName.c_str()), texOffset);
    };

    filesystem::path dataDir("/home/lead/Documents/Code/C++/OpenGL/OpenGL_BirdView/data");
    if (!exists(dataDir))
        cerr << "Invalid data path. Please correctly set \"dataDir\" variable." << endl;
    // Photos
    GLuint textures[6];
    setShaderTexture(textures, 0, 0, "u_texFront", dataDir / "front.jpg");
    setShaderTexture(textures, 1, 1, "u_texLeftFront", dataDir / "leftfront.jpg");
    setShaderTexture(textures, 2, 2, "u_texLeftBack", dataDir / "leftback.jpg");
    setShaderTexture(textures, 3, 3, "u_texRightFront", dataDir / "rightfront.jpg");
    setShaderTexture(textures, 4, 4, "u_texRightBack", dataDir / "rightback.jpg");
    setShaderTexture(textures, 5, 5, "u_texBack", dataDir / "back.jpg");
    // Blending masks
    GLuint masks[5];
    setShaderTexture(masks, 0, 6, "u_maskTopLeft", dataDir / "mask_topleft.jpg");
    setShaderTexture(masks, 1, 7, "u_maskTopRight", dataDir / "mask_topright.jpg");
    setShaderTexture(masks, 2, 8, "u_maskBtmLeft", dataDir / "mask_btmleft.jpg");
    setShaderTexture(masks, 3, 9, "u_maskBtmRight", dataDir / "mask_btmright.jpg");
    setShaderTexture(masks, 4, 10, "u_maskSides", dataDir / "mask_sides.jpg");

    // Set other uniforms in the shader from a yaml file
    Parameters params(dataDir / "parameters.yaml");
    params.setShaderUniforms(myShader);

    // set up vertex data (and buffer(s)) and configure vertex attributes (square)
    float vertices[] = {
            // positions
            1.0f, 1.0f, 0.0f,   // top right
            1.0f, -1.0f, 0.0f,  // bottom right
            -1.0f, -1.0f, 0.0f, // bottom left
            -1.0f, 1.0f, 0.0f,  // top left
    };
    unsigned int indices[] = {
            3, 1, 0, // first triangle
            3, 2, 1  // second triangle
    };
    GLuint VBO, VAO, EBO;
    glGenVertexArrays(1, &VAO);
    glGenBuffers(1, &VBO);
    glGenBuffers(1, &EBO);

    glBindVertexArray(VAO);
    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO);

    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices), indices, GL_STATIC_DRAW);

    // position attribute
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void *) nullptr);
    glEnableVertexAttribArray(0);

    ///================================ render loop ==============================
    // Clear colour and depth buffers
    double lastTime = glfwGetTime();
    int nbFrames = 0;
    while (!glfwWindowShouldClose(window)) {
        /// Measure speed
        double currentTime = glfwGetTime();
        nbFrames++;
        if (currentTime - lastTime >= 1.0) { // If last printf() was more than 1 sec ago
//            printf("%f ms/frame\n", 1000.0 / double(nbFrames));
            nbFrames = 0;
            lastTime += 1.0;
        }


        /// =========== Draw your scene here ==============
//        glClearColor(0.5f, 0.3f, 0.3f, 1.0f);
        glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, nullptr);
        /// ===============================================
        // Handle other events
        glfwPollEvents();
        // Flip buffers
        glfwSwapBuffers(window);
    }

    // optional: de-allocate all resources once they've outlived their purpose:
    // ------------------------------------------------------------------------
    glDeleteVertexArrays(1, &VAO);
    glDeleteBuffers(1, &VBO);
    glDeleteBuffers(1, &EBO);
    // glfw: terminate, clearing all previously allocated GLFW resources.
    // ------------------------------------------------------------------------
    glfwTerminate();
}

void handleKeyboardInput(GLFWwindow *window) {
    // Use escape key for terminating the GLFW window
    if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
        glfwSetWindowShouldClose(window, GL_TRUE);
}