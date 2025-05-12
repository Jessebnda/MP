import * as React from "react";
import { Frame } from "framer";
import { logInfo, logError, logWarn } from '../lib/logger';

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
      // Validación de origen con logs de seguridad
      if (event.origin !== allowedOrigin) {
        logWarn(`Mensaje rechazado de origen no permitido: ${event.origin}`);
        return;
      }

      // Validar el formato y estructura de datos
      try {
        const data = event.data || {};
        
        // Validar que el mensaje tiene un tipo válido
        if (!data.type || typeof data.type !== 'string') {
          logWarn('Mensaje con formato incorrecto rechazado');
          return;
        }
        
        switch (data.type) {
          case "MP_REDIRECT":
            // Validar URL antes de redireccionar
            if (!data.url || typeof data.url !== 'string' || 
                !(data.url.startsWith('http://') || data.url.startsWith('https://'))) {
              logError('URL de redirección inválida:', { url: data.url });
              return;
            }
            
            onRedirect(data.url, {
              status: data.status,
              orderId: data.orderId,
              amount: data.amount,
            });
            break;
            
          case "MP_REDIRECT_CONFIRM":
            logInfo("Confirmación de redirección recibida:", { url: data.url });
            break;
            
          default:
            logWarn("Tipo de mensaje no reconocido", { type: data.type });
            break;
        }
      } catch (error) {
        logError('Error al procesar mensaje:', { message: error.message });
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
