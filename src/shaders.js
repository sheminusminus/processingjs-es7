let navigator = window.navigator;
let webglMaxTempsWorkaround = /Windows/.test(navigator.userAgent),

export default const Shaders = {
  vertexShaderSrcUnlitShape:
      "varying vec4 vFrontColor;" +

      "attribute vec3 aVertex;" +
      "attribute vec4 aColor;" +

      "uniform mat4 uView;" +
      "uniform mat4 uProjection;" +
      "uniform float uPointSize;" +

      "void main(void) {" +
      "  vFrontColor = aColor;" +
      "  gl_PointSize = uPointSize;" +
      "  gl_Position = uProjection * uView * vec4(aVertex, 1.0);" +
      "}",

  fragmentShaderSrcUnlitShape:
      "#ifdef GL_ES\n" +
      "precision highp float;\n" +
      "#endif\n" +

      "varying vec4 vFrontColor;" +
      "uniform bool uSmooth;" +

      "void main(void){" +
      "  if(uSmooth == true){" +
      "    float dist = distance(gl_PointCoord, vec2(0.5));" +
      "    if(dist > 0.5){" +
      "      discard;" +
      "    }" +
      "  }" +
      "  gl_FragColor = vFrontColor;" +
      "}",

    // Shader for rect, text, box outlines, sphere outlines, point() and line().
  vertexShaderSrc2D:
      "varying vec4 vFrontColor;" +

      "attribute vec3 aVertex;" +
      "attribute vec2 aTextureCoord;" +
      "uniform vec4 uColor;" +

      "uniform mat4 uModel;" +
      "uniform mat4 uView;" +
      "uniform mat4 uProjection;" +
      "uniform float uPointSize;" +
      "varying vec2 vTextureCoord;"+

      "void main(void) {" +
      "  gl_PointSize = uPointSize;" +
      "  vFrontColor = uColor;" +
      "  gl_Position = uProjection * uView * uModel * vec4(aVertex, 1.0);" +
      "  vTextureCoord = aTextureCoord;" +
      "}",

  fragmentShaderSrc2D:
      "#ifdef GL_ES\n" +
      "precision highp float;\n" +
      "#endif\n" +

      "varying vec4 vFrontColor;" +
      "varying vec2 vTextureCoord;"+

      "uniform sampler2D uSampler;"+
      "uniform int uIsDrawingText;"+
      "uniform bool uSmooth;" +

      "void main(void){" +
      // WebGL does not support POINT_SMOOTH, so we do it ourselves
      "  if(uSmooth == true){" +
      "    float dist = distance(gl_PointCoord, vec2(0.5));" +
      "    if(dist > 0.5){" +
      "      discard;" +
      "    }" +
      "  }" +

      "  if(uIsDrawingText == 1){" +
      "    float alpha = texture2D(uSampler, vTextureCoord).a;"+
      "    gl_FragColor = vec4(vFrontColor.rgb * alpha, alpha);"+
      "  }" +
      "  else{" +
      "    gl_FragColor = vFrontColor;" +
      "  }" +
      "}",

  // Vertex shader for boxes and spheres.
  vertexShaderSrc3D:
      "varying vec4 vFrontColor;" +

      "attribute vec3 aVertex;" +
      "attribute vec3 aNormal;" +
      "attribute vec4 aColor;" +
      "attribute vec2 aTexture;" +
      "varying   vec2 vTexture;" +

      "uniform vec4 uColor;" +

      "uniform bool uUsingMat;" +
      "uniform vec3 uSpecular;" +
      "uniform vec3 uMaterialEmissive;" +
      "uniform vec3 uMaterialAmbient;" +
      "uniform vec3 uMaterialSpecular;" +
      "uniform float uShininess;" +

      "uniform mat4 uModel;" +
      "uniform mat4 uView;" +
      "uniform mat4 uProjection;" +
      "uniform mat4 uNormalTransform;" +

      "uniform int uLightCount;" +
      "uniform vec3 uFalloff;" +

      // Careful changing the order of these fields. Some cards
      // have issues with memory alignment.
      "struct Light {" +
      "  int type;" +
      "  vec3 color;" +
      "  vec3 position;" +
      "  vec3 direction;" +
      "  float angle;" +
      "  vec3 halfVector;" +
      "  float concentration;" +
      "};" +

      // nVidia cards have issues with arrays of structures
      // so instead we create 8 instances of Light.
      "uniform Light uLights0;" +
      "uniform Light uLights1;" +
      "uniform Light uLights2;" +
      "uniform Light uLights3;" +
      "uniform Light uLights4;" +
      "uniform Light uLights5;" +
      "uniform Light uLights6;" +
      "uniform Light uLights7;" +

     // GLSL does not support switch.
      "Light getLight(int index){" +
      "  if(index == 0) return uLights0;" +
      "  if(index == 1) return uLights1;" +
      "  if(index == 2) return uLights2;" +
      "  if(index == 3) return uLights3;" +
      "  if(index == 4) return uLights4;" +
      "  if(index == 5) return uLights5;" +
      "  if(index == 6) return uLights6;" +
      // Do not use a conditional for the last return statement
      // because some video cards will fail and complain that
      // "not all paths return".
      "  return uLights7;" +
      "}" +

      "void AmbientLight( inout vec3 totalAmbient, in vec3 ecPos, in Light light ) {" +
      // Get the vector from the light to the vertex and
      // get the distance from the current vector to the light position.
      "  float d = length( light.position - ecPos );" +
      "  float attenuation = 1.0 / ( uFalloff[0] + ( uFalloff[1] * d ) + ( uFalloff[2] * d * d ));" +
      "  totalAmbient += light.color * attenuation;" +
      "}" +

      /*
        col - accumulated color
        spec - accumulated specular highlight
        vertNormal - Normal of the vertex
        ecPos - eye coordinate position
        light - light structure
      */
      "void DirectionalLight( inout vec3 col, inout vec3 spec, in vec3 vertNormal, in vec3 ecPos, in Light light ) {" +
      "  float powerFactor = 0.0;" +
      "  float nDotVP = max(0.0, dot( vertNormal, normalize(-light.position) ));" +
      "  float nDotVH = max(0.0, dot( vertNormal, normalize(-light.position-normalize(ecPos) )));" +

      "  if( nDotVP != 0.0 ){" +
      "    powerFactor = pow( nDotVH, uShininess );" +
      "  }" +

      "  col += light.color * nDotVP;" +
      "  spec += uSpecular * powerFactor;" +
      "}" +

      /*
        col - accumulated color
        spec - accumulated specular highlight
        vertNormal - Normal of the vertex
        ecPos - eye coordinate position
        light - light structure
      */
      "void PointLight( inout vec3 col, inout vec3 spec, in vec3 vertNormal, in vec3 ecPos, in Light light ) {" +
      "  float powerFactor;" +

      // Get the vector from the light to the vertex.
      "   vec3 VP = light.position - ecPos;" +

      // Get the distance from the current vector to the light position.
      "  float d = length( VP ); " +

      // Normalize the light ray so it can be used in the dot product operation.
      "  VP = normalize( VP );" +

      "  float attenuation = 1.0 / ( uFalloff[0] + ( uFalloff[1] * d ) + ( uFalloff[2] * d * d ));" +

      "  float nDotVP = max( 0.0, dot( vertNormal, VP ));" +
      "  vec3 halfVector = normalize( VP - normalize(ecPos) );" +
      "  float nDotHV = max( 0.0, dot( vertNormal, halfVector ));" +

      "  if( nDotVP == 0.0 ) {" +
      "    powerFactor = 0.0;" +
      "  }" +
      "  else {" +
      "    powerFactor = pow( nDotHV, uShininess );" +
      "  }" +

      "  spec += uSpecular * powerFactor * attenuation;" +
      "  col += light.color * nDotVP * attenuation;" +
      "}" +

      /*
        col - accumulated color
        spec - accumulated specular highlight
        vertNormal - Normal of the vertex
        ecPos - eye coordinate position
        light - light structure
      */
      "void SpotLight( inout vec3 col, inout vec3 spec, in vec3 vertNormal, in vec3 ecPos, in Light light ) {" +
      "  float spotAttenuation;" +
      "  float powerFactor = 0.0;" +

      // Calculate the vector from the current vertex to the light.
      "  vec3 VP = light.position - ecPos;" +
      "  vec3 ldir = normalize( -light.direction );" +

      // Get the distance from the spotlight and the vertex
      "  float d = length( VP );" +
      "  VP = normalize( VP );" +

      "  float attenuation = 1.0 / ( uFalloff[0] + ( uFalloff[1] * d ) + ( uFalloff[2] * d * d ) );" +

      // Dot product of the vector from vertex to light and light direction.
      "  float spotDot = dot( VP, ldir );" +

      // If the vertex falls inside the cone
      (webglMaxTempsWorkaround ? // Windows reports max temps error if light.angle is used
      "  spotAttenuation = 1.0; " :
      "  if( spotDot > cos( light.angle ) ) {" +
      "    spotAttenuation = pow( spotDot, light.concentration );" +
      "  }" +
      "  else{" +
      "    spotAttenuation = 0.0;" +
      "  }" +
      "  attenuation *= spotAttenuation;" +
      "") +

      "  float nDotVP = max( 0.0, dot( vertNormal, VP ) );" +
      "  vec3 halfVector = normalize( VP - normalize(ecPos) );" +
      "  float nDotHV = max( 0.0, dot( vertNormal, halfVector ) );" +

      "  if( nDotVP != 0.0 ) {" +
      "    powerFactor = pow( nDotHV, uShininess );" +
      "  }" +

      "  spec += uSpecular * powerFactor * attenuation;" +
      "  col += light.color * nDotVP * attenuation;" +
      "}" +

      "void main(void) {" +
      "  vec3 finalAmbient = vec3( 0.0 );" +
      "  vec3 finalDiffuse = vec3( 0.0 );" +
      "  vec3 finalSpecular = vec3( 0.0 );" +

      "  vec4 col = uColor;" +

      "  if ( uColor[0] == -1.0 ){" +
      "    col = aColor;" +
      "  }" +

      // We use the sphere vertices as the normals when we create the sphere buffer.
      // But this only works if the sphere vertices are unit length, so we
      // have to normalize the normals here. Since this is only required for spheres
      // we could consider placing this in a conditional later on.
      "  vec3 norm = normalize(vec3( uNormalTransform * vec4( aNormal, 0.0 ) ));" +

      "  vec4 ecPos4 = uView * uModel * vec4(aVertex, 1.0);" +
      "  vec3 ecPos = (vec3(ecPos4))/ecPos4.w;" +

      // If there were no lights this draw call, just use the
      // assigned fill color of the shape and the specular value.
      "  if( uLightCount == 0 ) {" +
      "    vFrontColor = col + vec4(uMaterialSpecular, 1.0);" +
      "  }" +
      "  else {" +
           // WebGL forces us to iterate over a constant value
           // so we can't iterate using lightCount.
      "    for( int i = 0; i < 8; i++ ) {" +
      "      Light l = getLight(i);" +

      // We can stop iterating if we know we have gone past
      // the number of lights which are actually on. This gives us a
      // significant performance increase with high vertex counts.
      "      if( i >= uLightCount ){" +
      "        break;" +
      "      }" +

      "      if( l.type == 0 ) {" +
      "        AmbientLight( finalAmbient, ecPos, l );" +
      "      }" +
      "      else if( l.type == 1 ) {" +
      "        DirectionalLight( finalDiffuse, finalSpecular, norm, ecPos, l );" +
      "      }" +
      "      else if( l.type == 2 ) {" +
      "        PointLight( finalDiffuse, finalSpecular, norm, ecPos, l );" +
      "      }" +
      "      else {" +
      "        SpotLight( finalDiffuse, finalSpecular, norm, ecPos, l );" +
      "      }" +
      "    }" +

      "   if( uUsingMat == false ) {" +
      "     vFrontColor = vec4(" +
      "       vec3( col ) * finalAmbient +" +
      "       vec3( col ) * finalDiffuse +" +
      "       vec3( col ) * finalSpecular," +
      "       col[3] );" +
      "   }" +
      "   else{" +
      "     vFrontColor = vec4( " +
      "       uMaterialEmissive + " +
      "       (vec3(col) * uMaterialAmbient * finalAmbient ) + " +
      "       (vec3(col) * finalDiffuse) + " +
      "       (uMaterialSpecular * finalSpecular), " +
      "       col[3] );" +
      "    }" +
      "  }" +

      "  vTexture.xy = aTexture.xy;" +
      "  gl_Position = uProjection * uView * uModel * vec4( aVertex, 1.0 );" +
      "}",

  fragmentShaderSrc3D:
      "#ifdef GL_ES\n" +
      "precision highp float;\n" +
      "#endif\n" +

      "varying vec4 vFrontColor;" +

      "uniform sampler2D uSampler;" +
      "uniform bool uUsingTexture;" +
      "varying vec2 vTexture;" +

      // In Processing, when a texture is used, the fill color is ignored
      // vec4(1.0,1.0,1.0,0.5)
      "void main(void){" +
      "  if( uUsingTexture ){" +
      "    gl_FragColor = vec4(texture2D(uSampler, vTexture.xy)) * vFrontColor;" +
      "  }"+
      "  else{" +
      "    gl_FragColor = vFrontColor;" +
      "  }" +
      "}"
};
