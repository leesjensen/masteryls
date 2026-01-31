import { useState } from 'react';

let globalSearchResults = null;
let globalSearchResultsSetters = [];

export function useSearchResults() {
  const [searchResults, setSearchResults] = useState(null);

  const updateResults = (newResults) => {
    globalSearchResults = newResults;
    setSearchResults(newResults);
    // Notify all other instances of this hook
    globalSearchResultsSetters.forEach((setter) => setter(newResults));
  };

  // Register this component's setter
  if (!globalSearchResultsSetters.includes(setSearchResults)) {
    globalSearchResultsSetters.push(setSearchResults);
  }

  // Cleanup on unmount
  const cleanup = () => {
    globalSearchResultsSetters = globalSearchResultsSetters.filter((setter) => setter !== setSearchResults);
  };

  return {
    searchResults: globalSearchResults ?? searchResults,
    setSearchResults: updateResults,
    cleanup,
  };
}
