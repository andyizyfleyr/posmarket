import os from 'os';

export function getLocalIp() {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    const networkInterfaces = interfaces[name];
    if (networkInterfaces) {
      for (const iface of networkInterfaces) {
        if (
          iface.family === 'IPv4' &&
          !iface.internal
        ) {
          return iface.address;
        }
      }
    }
  }

  return 'localhost';
}
