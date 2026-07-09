// Force outbound HTTP requests over IPv4. The VPS has IPv6 enabled and some
// PM2 workers may otherwise reach Plisio over IPv6, which triggers their
// allowed-IP protection even when the IPv4 address is whitelisted.
//
// This helper avoids Node-only top-level imports so it stays safe when the file
// is statically reachable from server function modules.

async function requestOverIpv4(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const [{ request: httpsRequest, Agent }, { URL: NodeURL }] = await Promise.all([
    import("node:https"),
    import("node:url"),
  ]);

  const source = input instanceof Request
    ? input.url
    : input instanceof URL
      ? input.toString()
      : String(input);

  const url = new NodeURL(source);
  const method = init.method ?? (input instanceof Request ? input.method : "GET");
  const headers = new Headers(input instanceof Request ? input.headers : init.headers);
  const body = init.body ?? (input instanceof Request ? input.body : undefined);

  if (body && typeof body !== "string" && !(body instanceof Uint8Array) && !(body instanceof ArrayBuffer)) {
    throw new Error("fetchIpv4 currently supports string and binary request bodies only");
  }

  const bodyBuffer =
    typeof body === "string"
      ? Buffer.from(body)
      : body instanceof Uint8Array
        ? Buffer.from(body)
        : body instanceof ArrayBuffer
          ? Buffer.from(body)
          : undefined;

  if (bodyBuffer && !headers.has("content-length")) {
    headers.set("content-length", String(bodyBuffer.byteLength));
  }

  return new Promise<Response>((resolve, reject) => {
    const agent = new Agent({ family: 4, keepAlive: false });
    const req = httpsRequest(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method,
        headers: Object.fromEntries(headers.entries()),
        agent,
        family: 4,
        timeout: 90000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          const payload = Buffer.concat(chunks);
          const status = res.statusCode ?? 500;
          // 204 / 205 / 304 must have a null body per the Response spec.
          const nullBodyStatus = status === 204 || status === 205 || status === 304;
          resolve(
            new Response(nullBodyStatus ? null : payload, {
              status,
              statusText: res.statusMessage ?? "",
              headers: new Headers(
                Object.entries(res.headers).flatMap(([key, value]): [string, string][] => {
                  if (Array.isArray(value)) return value.map((v): [string, string] => [key, v]);
                  return value == null ? [] : [[key, String(value)]];
                }),
              ),
            }),
          );
        });

      },
    );

    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Request timeout (ipv4)")));

    const abort = () => req.destroy(new Error("Request aborted"));
    if (init.signal) {
      if (init.signal.aborted) {
        abort();
        return;
      }
      init.signal.addEventListener("abort", abort, { once: true });
      req.on("close", () => init.signal?.removeEventListener("abort", abort));
    }

    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });

}

export const fetchIpv4: typeof fetch = (async (input: any, init: any = {}) => {
  if (typeof window !== "undefined") return fetch(input, init);
  return requestOverIpv4(input, init);
}) as unknown as typeof fetch;
