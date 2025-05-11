import * as React from "react";
import { Frame } from "framer";

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
  const iframeRef = React.useRef(null);

  React.useEffect(() => {
    function handleMessage(event) {
      // 1) Ignorar mensajes de otros orígenes
      if (event.origin !== allowedOrigin) return;

      const data = event.data || {};
      switch (data.type) {
        case "MP_REDIRECT":
          // Aquí recibes { url, status, orderId, amount }
          onRedirect(data.url, {
            status: data.status,
            orderId: data.orderId,
            amount: data.amount,
          });
          break;

        case "MP_REDIRECT_CONFIRM":
          // Confirmación opcional
          console.log("Parent recibió confirmación de redirect a:", data.url);
          break;

        default:
          break;
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [allowedOrigin, onRedirect]);

  return (
    <Frame width={width} height={height} background="none" overflow="hidden">
      <iframe
        ref={iframeRef}
        src={src}
        style={{ width: "100%", height: "100%", border: "none" }}
      />
    </Frame>
  );
}
