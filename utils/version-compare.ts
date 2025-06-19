/**
 * Compare two semantic version strings
 * @param current Current version (e.g., "0.1.0")
 * @param latest Latest version (e.g., "1.1.5")
 * @returns true if latest > current, false otherwise
 */
export function isUpdateAvailable(current: string, latest: string): boolean {
  // Remove 'v' prefix if present
  const cleanCurrent = current.replace(/^v/, "");
  const cleanLatest = latest.replace(/^v/, "");
  
  const currentParts = cleanCurrent.split(".").map(Number);
  const latestParts = cleanLatest.split(".").map(Number);
  
  // Ensure both arrays have the same length by padding with zeros
  const maxLength = Math.max(currentParts.length, latestParts.length);
  while (currentParts.length < maxLength) currentParts.push(0);
  while (latestParts.length < maxLength) latestParts.push(0);
  
  // Compare each part
  for (let i = 0; i < maxLength; i++) {
    if (latestParts[i] > currentParts[i]) {
      return true;
    } else if (latestParts[i] < currentParts[i]) {
      return false;
    }
  }
  
  return false;
}

/**
 * Fetch the latest release information from GitHub API
 * @returns Promise<{version: string, url: string} | null>
 */
export async function fetchLatestRelease(): Promise<{version: string, url: string} | null> {
  try {
    const response = await fetch("https://api.github.com/repos/Narratium/Narratium.ai/releases/latest");
    if (!response.ok) {
      console.warn("Failed to fetch latest release info");
      return null;
    }
    
    const data = await response.json();
    return {
      version: data.tag_name,
      url: data.html_url,
    };
  } catch (error) {
    console.warn("Error fetching latest release:", error);
    return null;
  }
} 
