function isSupportedProtocol(url) {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

function feedbackForStatus(status) {
  if (status >= 200 && status < 300) {
    return 'URL verified successfully. The page responded to the validation request.';
  }
  if (status >= 300 && status < 400) {
    return `URL responded with a redirect status (${status}). Please verify the final destination.`;
  }
  if (status >= 400 && status < 500) {
    return `URL responded with a client error (${status}). Please check the address and permissions.`;
  }
  if (status >= 500) {
    return `URL responded with a server error (${status}). Try again later or use a different URL.`;
  }
  return `URL validation returned status ${status}.`;
}

export async function validateSubmittedUrl({ url, validateUrl = false, fetchImpl = globalThis.fetch, timeoutMs = 8000 }) {
  if (!url) {
    return { percentCorrect: 0, feedback: 'Please provide a URL before submitting.' };
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { percentCorrect: 0, feedback: 'The provided value is not a valid URL format.' };
  }

  if (!isSupportedProtocol(parsed)) {
    return { percentCorrect: 0, feedback: 'Only http and https URLs are supported.' };
  }

  if (!validateUrl) {
    return { percentCorrect: 100, feedback: 'Submission received. Thank you!' };
  }

  if (typeof fetchImpl !== 'function') {
    return { percentCorrect: 30, feedback: 'Validation is enabled, but fetch is not available in this environment.' };
  }

  let timerId;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

  try {
    if (controller) {
      timerId = setTimeout(() => controller.abort(), timeoutMs);
    }

    const response = await fetchImpl(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller?.signal,
    });

    if (timerId) clearTimeout(timerId);

    if (response.ok) {
      return { percentCorrect: 100, feedback: feedbackForStatus(response.status), validationStatus: response.status };
    }

    if (response.status >= 300 && response.status < 400) {
      return { percentCorrect: 60, feedback: feedbackForStatus(response.status), validationStatus: response.status };
    }

    return { percentCorrect: 20, feedback: feedbackForStatus(response.status), validationStatus: response.status };
  } catch (error) {
    if (timerId) clearTimeout(timerId);
    const message = error?.name === 'AbortError' ? 'Validation request timed out.' : 'Unable to validate URL. The target may block browser requests (CORS), be unavailable, or the network may be down.';
    return { percentCorrect: 30, feedback: message };
  }
}
