import { Unity, useUnityContext } from "react-unity-webgl";

export default function GameTest() {
  const { unityProvider } = useUnityContext({
    loaderUrl: "/Cat-Escape-WebGL/Build/Game1.loader.js",
    dataUrl: "/Cat-Escape-WebGL/Build/Game1.data",
    frameworkUrl: "/Cat-Escape-WebGL/Build/Game1.framework.js",
    codeUrl: "/Cat-Escape-WebGL/Build/Game1.wasm",
  });

  return <Unity unityProvider={unityProvider} style={{ width: "100%", height: "100%" }} />;
}