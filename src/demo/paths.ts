export function isDemoPath(pathname: string): boolean {
  return pathname === "/demo" || pathname.startsWith("/demo/");
}

export function withDemoPrefix(path: string, currentPathname: string): string {
  if (!isDemoPath(currentPathname)) return path;
  if (!path.startsWith("/")) return path;
  if (path === "/demo" || path.startsWith("/demo/")) return path;
  return `/demo${path}`;
}
