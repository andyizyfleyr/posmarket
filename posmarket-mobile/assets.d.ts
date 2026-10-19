/**
 * Déclarations de types pour les assets statiques importés via ES import
 * (résolus par Metro). Permet `import logo from '../assets/logo.png'`
 * au lieu de `require(...)`.
 */

declare module '*.png' {
  const asset: number;
  export default asset;
}

declare module '*.jpg' {
  const asset: number;
  export default asset;
}

declare module '*.jpeg' {
  const asset: number;
  export default asset;
}

declare module '*.webp' {
  const asset: number;
  export default asset;
}

declare module '*.gif' {
  const asset: number;
  export default asset;
}
