export function buildOwnerInvitationMessage(input: {
  draftName: string;
  teamName: string;
  email: string;
  joinUrl: string;
}) {
  return [
    `You are invited to ${input.draftName} in DraftHQ as ${input.teamName}.`,
    `Open ${input.joinUrl}`,
    `Log in or create an account with ${input.email} so DraftHQ can assign your team.`,
  ].join("\n");
}
