import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.177.0/testing/asserts.ts";
import {
  base64Url,
  buildRFC822,
  handleRequest,
} from "./handler.ts";

function makeReq(body: unknown, opts: { secret?: string } = {}): Request {
  return new Request("http://localhost/send-lead-reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.secret ? { "x-app-secret": opts.secret } : {}),
    },
    body: JSON.stringify(body),
  });
}

function sbStub(leads: Record<string, unknown>[], insertResult: { id?: number; error?: string } = { id: 42 }) {
  const insertCalls: Record<string, unknown>[] = [];
  const api = {
    from(table: string) {
      let filters: Record<string, unknown> = {};
      const chain: Record<string, unknown> = {
        select(_s: string) { return chain; },
        eq(col: string, val: unknown) { filters[col] = val; return chain; },
        limit(_n: number) {
          const rows = leads.filter((r) => {
            for (const [k, v] of Object.entries(filters)) {
              if ((r as Record<string, unknown>)[k] !== v) return false;
            }
            return true;
          });
          if (table === "lead_messages") {
            // this is the returned row from select after insert
            return Promise.resolve({ data: insertResult.id ? [{ id: insertResult.id }] : [], error: insertResult.error ? { message: insertResult.error } : null });
          }
          return Promise.resolve({ data: rows, error: null });
        },
        insert(payload: Record<string, unknown>) {
          insertCalls.push(payload);
          return chain;
        },
      };
      return chain;
    },
    _insertCalls: insertCalls,
    // deno-lint-ignore no-explicit-any
  } as any;
  return api;
}

const ENV_OK = {
  SUGGEST_REPLY_SECRET: "secret",
  GMAIL_CLIENT_ID: "cid",
  GMAIL_CLIENT_SECRET: "csec",
  GMAIL_REFRESH_TOKEN: "rtk",
  SUPABASE_URL: "http://stub",
  SUPABASE_SERVICE_ROLE_KEY: "stub",
};

// ── encoders ────────────────────────────────────────────────────────────

Deno.test("base64Url: url-safe encoding without padding", () => {
  const out = base64Url("hello??");
  assert(!out.includes("="));
  assert(!out.includes("+"));
  assert(!out.includes("/"));
});

Deno.test("buildRFC822: includes To, From, Subject, body", () => {
  const msg = buildRFC822({ to: "a@b.com", from: "c@d.com", subject: "hola ñ", body: "cuerpo" });
  assertStringIncludes(msg, "To: a@b.com");
  assertStringIncludes(msg, "From: c@d.com");
  assertStringIncludes(msg, "Subject: =?UTF-8?B?");
  assertStringIncludes(msg, "cuerpo");
});

// ── auth ────────────────────────────────────────────────────────────────

Deno.test("handleRequest: 401 without secret", async () => {
  const res = await handleRequest(makeReq({ leadId: 1, text: "hola" }), { env: ENV_OK });
  assertEquals(res.status, 401);
});

// ── validation ──────────────────────────────────────────────────────────

Deno.test("handleRequest: 400 without text", async () => {
  const res = await handleRequest(
    makeReq({ leadId: 1 }, { secret: "secret" }),
    { env: ENV_OK },
  );
  assertEquals(res.status, 400);
});

// ── OAuth no configurado ───────────────────────────────────────────────

Deno.test("handleRequest: OAuth no configurado → can_send:false", async () => {
  const sb = sbStub([{ id: 1, company_id: 1, name: "Jose", reply_to_email: "uuid@contactos.coches.net", vehicle_interest: "Polo", estado: "nuevo" }]);
  const envMissing = { SUGGEST_REPLY_SECRET: "secret", SUPABASE_URL: "x", SUPABASE_SERVICE_ROLE_KEY: "y" };
  const res = await handleRequest(
    makeReq({ leadId: 1, text: "Buenas!!" }, { secret: "secret" }),
    { env: envMissing, supabase: sb },
  );
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.ok, false);
  assertEquals(json.can_send, false);
  assertStringIncludes(json.error, "Gmail OAuth");
});

Deno.test("handleRequest: lead sin reply_to_email → can_send:false", async () => {
  const sb = sbStub([{ id: 1, company_id: 1, name: "Jose", reply_to_email: null, vehicle_interest: null, estado: "nuevo" }]);
  const res = await handleRequest(
    makeReq({ leadId: 1, text: "Buenas!!" }, { secret: "secret" }),
    { env: ENV_OK, supabase: sb },
  );
  const json = await res.json();
  assertEquals(json.ok, false);
  assertEquals(json.can_send, false);
  assertStringIncludes(json.error, "reply_to_email");
});

// ── flujo completo ─────────────────────────────────────────────────────

Deno.test("handleRequest: envío exitoso → 200 ok + inserta lead_message", async () => {
  const sb = sbStub([{ id: 5, company_id: 1, name: "Jose", reply_to_email: "abc@contactos.coches.net", vehicle_interest: "Polo", estado: "nuevo" }]);
  const res = await handleRequest(
    makeReq({ leadId: 5, text: "Buenas!!" }, { secret: "secret" }),
    {
      env: ENV_OK,
      supabase: sb,
      getTokenFn: () => Promise.resolve("tok"),
      sendFn: () => Promise.resolve("gmail-id-123"),
      now: () => new Date("2026-04-21T09:00:00Z"),
    },
  );
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.ok, true);
  assertEquals(json.gmail_message_id, "gmail-id-123");
  assertEquals(json.lead_message_id, 42);
  assertEquals(sb._insertCalls.length, 1);
  const inserted = sb._insertCalls[0];
  assertEquals(inserted.lead_id, 5);
  assertEquals(inserted.sender, "dealer");
  assertEquals(inserted.content, "Buenas!!");
  assertEquals(inserted.gmail_message_id, "gmail-id-123");
});

Deno.test("handleRequest: Gmail API falla → ok:false can_send:true", async () => {
  const sb = sbStub([{ id: 6, company_id: 1, name: "Jose", reply_to_email: "abc@contactos.coches.net", vehicle_interest: "Polo", estado: "nuevo" }]);
  const res = await handleRequest(
    makeReq({ leadId: 6, text: "hola" }, { secret: "secret" }),
    {
      env: ENV_OK,
      supabase: sb,
      getTokenFn: () => Promise.resolve("tok"),
      sendFn: () => Promise.reject(new Error("Gmail send error 403: insufficient scope")),
    },
  );
  const json = await res.json();
  assertEquals(json.ok, false);
  assertEquals(json.can_send, true);
  assertStringIncludes(json.error, "Gmail send error 403");
  assertEquals(sb._insertCalls.length, 0); // nada insertado si el envío falló
});
