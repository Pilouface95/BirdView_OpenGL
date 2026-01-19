#
# Specify minimum CMake version and project name
#
cmake_minimum_required(VERSION 3.15)
project(BirdView_OpenGL)

#
# CMake setup
#
set_property(GLOBAL PROPERTY USE_FOLDERS ON)
set(CMAKE_VERBOSE_MAKEFILE 0) # 1 should be used for debugging
set(CMAKE_SUPPRESS_REGENERATION TRUE) # Suppresses ZERO_CHECK
if (MSVC)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /W4")
else ()
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -Wextra -Wpedantic -std=c++17")
    if (NOT WIN32)
        set(GLAD_LIBRARIES dl)
    endif ()
endif ()

#
# GLFW options
#
option(GLFW_INSTALL OFF)
option(GLFW_BUILD_DOCS OFF)
option(GLFW_BUILD_EXAMPLES OFF)
option(GLFW_BUILD_TESTS OFF)
add_subdirectory(code/vendor/glfw)

#
# Set include paths
#
include_directories(code/src/
        code/vendor/glad/include/
        code/vendor/glfw/include/
        code/vendor/glm/
        code/vendor/stb/
        code/vendor/yaml-cpp/include/
)

#
# Add files
#
file(GLOB VENDORS_SOURCES code/vendor/glad/src/glad.c)
file(GLOB_RECURSE PROJECT_HEADERS code/src/*.hpp
        code/src/*.h)
file(GLOB_RECURSE PROJECT_SOURCES code/src/*.cpp
        code/src/*.cxx
        code/src/*.cc
        code/src/*.c)
file(GLOB_RECURSE PROJECT_SHADERS code/shaders/*.comp
        code/shaders/*.frag
        code/shaders/*.geom
        code/shaders/*.vert)
file(GLOB PROJECT_CONFIGS CMakeLists.txt
        README.rst
        .gitignore
        .gitmodules)

#
# Organizing files
#
source_group("headers" FILES ${PROJECT_HEADERS})
source_group("shaders" FILES ${PROJECT_SHADERS})
source_group("sources" FILES ${PROJECT_SOURCES})
source_group("vendors" FILES ${VENDORS_SOURCES})

#
# Set executable and target link libraries
#
add_definitions(-DGLFW_INCLUDE_NONE
        -DPROJECT_SOURCE_DIR=\"${PROJECT_SOURCE_DIR}\")
add_executable(${PROJECT_NAME} ${PROJECT_SOURCES} ${PROJECT_HEADERS}
        ${PROJECT_SHADERS} ${PROJECT_CONFIGS}
        ${VENDORS_SOURCES})

# Eigen3
find_package(Eigen3 REQUIRED)
include_directories(${EIGEN3_INCLUDE_DIRS})


target_link_libraries(${PROJECT_NAME}
        glfw
        ${GLFW_LIBRARIES}
        ${GLAD_LIBRARIES}
        ${CMAKE_SOURCE_DIR}/code/vendor/yaml-cpp/build/libyaml-cpp.so
)
set_target_properties(${PROJECT_NAME} PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/${PROJECT_NAME})
