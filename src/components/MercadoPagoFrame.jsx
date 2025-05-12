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
      // Validación de origen con logs de seguridad
      if (event.origin !== allowedOrigin) {
        console.warn(`Mensaje rechazado de origen no permitido: ${event.origin}`);
        return;
      }

      // Validar el formato y estructura de datos
      try {
        const data = event.data || {};
        
        // Validar que el mensaje tiene un tipo válido
        if (!data.type || typeof data.type !== 'string') {
          console.warn('Mensaje con formato incorrecto rechazado');
          return;
        }
        
        switch (data.type) {
          case "MP_REDIRECT":
            // Validar URL antes de redireccionar
            if (!data.url || typeof data.url !== 'string' || 
                !(data.url.startsWith('http://') || data.url.startsWith('https://'))) {
              console.error('URL de redirección inválida:', data.url);
              return;
            }
            
            onRedirect(data.url, {
              status: data.status,
              orderId: data.orderId,
              amount: data.amount,
            });
            break;
            
          case "MP_REDIRECT_CONFIRM":
            console.log("Confirmación de redirección recibida:", data.url);
            break;
            
          default:
            console.warn(`Tipo de mensaje no reconocido: ${data.type}`);
            break;
        }
      } catch (error) {
        console.error('Error al procesar mensaje:', error);
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
