import React, { useEffect } from 'react';
import { Frame } from 'framer';
import { logInfo, logError, logWarn } from '../lib/logger';

export function StandaloneCartFrame({
  src = "https://mercadopagoiframe.vercel.app/cart-button",
  width = "50px",
  height = "50px",
  onCartUpdate = () => {},
  buttonColor = "#333333",
  buttonSize = "24",
  allowedOrigin = "https://mercadopagoiframe.vercel.app",
}) {
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== allowedOrigin) {
        logWarn(
          `Mensaje ignorado de origen no permitido: ${event.origin}. Esperado: ${allowedOrigin}`
        );
        return;
      }

      if (event.data && event.data.type === "MP_CART_UPDATE") {
        logInfo("MP_CART_UPDATE recibido:", event.data.cart);
        if (onCartUpdate) {
          onCartUpdate(event.data.cart);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onCartUpdate, allowedOrigin]);

  // Generate URL with parameters for the cart button
  const urlWithParams = new URL(src);
  urlWithParams.searchParams.append('buttonColor', buttonColor.replace('#', ''));
  urlWithParams.searchParams.append('buttonSize', buttonSize);

  return (
    <Frame
      src={urlWithParams.toString()}
      width={width}
      height={height}
      style={{ border: "none", overflow: "visible" }}
    />
  );
}