import * as React from "react";
import { Frame } from "framer";
import { logInfo, logError, logWarn } from '../utils/logger'; // Changed from ../lib/logger

export function MercadoPagoFrame({
  // Tu deploy en Vercel
  src = "https://mercadopagoiframe.vercel.app/",
  width = "100%",
  height = "100%",
  // Callback que se dispara cuando recibimos MP_REDIRECT
  onRedirect = (url, meta) => {
    // Por defecto, navegamos a la URL completa
    window.location.href = url;
  },
  // Para mayor seguridad, valida que venga de este origen
  allowedOrigin = "https://mercadopagoiframe.vercel.app",
}) {
  React.useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== allowedOrigin) {
        logWarn(
          `Mensaje ignorado de origen no permitido: ${event.origin}. Esperado: ${allowedOrigin}`
        );
        return;
      }

      if (event.data && event.data.type === "MP_REDIRECT") {
        logInfo("MP_REDIRECT recibido:", event.data);
        if (onRedirect) {
          onRedirect(event.data.url, event.data.meta);
        }
      } else {
        logInfo("Mensaje recibido del iframe:", event.data);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onRedirect, allowedOrigin]);

  return (
    <Frame
      src={src}
      width={width}
      height={height}
      style={{ border: "none" }}
      allow="payment"
    />
  );
}
