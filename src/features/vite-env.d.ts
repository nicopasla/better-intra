declare module "*.css" {
  const content: any;
  export default content;
}
declare module "*.css?inline" {
  const content: any;
  export default content;
}
declare module "*.svg" {
  const content: string;
  export default content;
}
declare module "*.svg?raw" {
  const content: string;
  export default content;
}
declare const __APP_VERSION__: string;
