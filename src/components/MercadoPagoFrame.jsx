import * as React from "react";
// Remove this line
// import { Frame } from "framer";
import { logInfo, logError, logWarn } from '../utils/logger';

export function MercadoPagoFrame({
  src = "https://mercadopagoiframe.vercel.app/",
  width = "100%",
  height = "100%",
  onRedirect = (url, meta) => {
    window.location.href = url;
  },
  allowedOrigin = "https://mercadopagoiframe.vercel.app",
}) {
  React.useEffect(() => {
    const handleMessage = (event) => {
      const allowedOrigins = [
        allowedOrigin,
        "https://framer.com",
        "https://app.framer.com"
      ];

      if (!allowedOrigins.some(origin => event.origin.includes(origin.replace('https://', '')))) {
        logWarn(`Mensaje ignorado de origen no permitido: ${event.origin}`);
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
    <iframe
      src={src}
      width={width}
      height={height}
      style={{ border: "none" }}
      allow="payment"
      title="MercadoPago Payment"
    />
  );
}
