/**
 * Agent email identity helper shared across V2 send paths.
 */

export interface IdentityInput {
  name: string;
  local_part: string;
  domain: string;
}

export function buildAgentEmailIdentity(agent: IdentityInput) {
  const email = `${agent.local_part}@${agent.domain}`;
  const fromHeader = `${agent.name} <${email}>`;
  return { fromHeader, replyTo: fromHeader, domain: agent.domain };
}

