export async function getCurrentTime(args?: any) {
  return new Date().toLocaleString();
}

export const tools = {
  get_current_time: {
    description: "Returns the current local time.",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: getCurrentTime,
  },
};
