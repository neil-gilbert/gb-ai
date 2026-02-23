export function getTimeOfDayGreeting(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) {
    return "morning";
  }

  if (hour < 18) {
    return "afternoon";
  }

  return "evening";
}

export function formatFirstName(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  const [firstNameRaw = ""] = localPart.split(/[._-]/);
  if (!firstNameRaw) {
    return "";
  }

  return firstNameRaw.charAt(0).toUpperCase() + firstNameRaw.slice(1);
}

export function buildGreetingText(email?: string): string {
  const greeting = getTimeOfDayGreeting(new Date().getHours());
  const firstName = email ? formatFirstName(email) : "";
  return `Good ${greeting}${firstName ? ` ${firstName}` : ""}.`;
}
