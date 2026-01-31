import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, Search, X } from 'lucide-react';
import { useSearchResults } from '../hooks/useSearchResults';

export default function SearchCourse({ courseOps, learningSession }) {
  const { searchResults, setSearchResults } = useSearchResults();
  const [query, setQuery] = useState(searchResults?.query || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  async function handleClear() {
    setQuery('');
    setSearchResults(null);
    setError(null);
  }

  async function handleSearch(e) {
    e.preventDefault();

    setLoading(true);
    setSearchResults(null);
    setError(null);
    try {
      const searchResults = await courseOps.searchCourse(query);
      setSearchResults(searchResults);
    } catch (err) {
      setError('Failed to search. Try again later.');
    } finally {
      setLoading(false);
    }
  }

  function viewResult(result) {
    navigate(`/course/${learningSession.course.id}/topic/${result.topic.id}`);
  }

  function highlightMatch(text) {
    const parts = [];
    let lastIndex = 0;
    const regex = /<mark>(.*?)<\/mark>/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      parts.push(
        <mark key={match.index} className="bg-yellow-200">
          {match[1]}
        </mark>,
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return <span>{parts}</span>;
  }

  function renderResults() {
    if (error) return <div className="text-red-600 text-xs mb-3">{error}</div>;
    if (searchResults && searchResults.matches.length === 0) {
      return <div className="text-gray-500 text-xs">No results found</div>;
    } else if (searchResults) {
      return (
        <div className="flex-1 overflow-auto">
          <div className="text-gray-600 text-xs mb-2">
            {searchResults.matches.length} matching topic{searchResults.matches.length !== 1 ? 's' : ''}
          </div>

          {searchResults.matches.length > 0 && (
            <div className="space-y-2">
              {searchResults.matches.map((result, idx) => (
                <div key={idx} className="border border-gray-200 rounded-md p-2 bg-white">
                  <div className="font-semibold text-xs text-gray-900">{result.topic.title}</div>
                  {result.headlines && result.headlines.length > 0 && (
                    <div className="space-y-1 mt-1">
                      {result.headlines.map((headline, mid) => (
                        <div key={mid} className="border-l-2 cursor-pointer border-blue-300 p-2 text-xs text-gray-700 px-1.5" onClick={() => viewResult(result)}>
                          {highlightMatch(headline)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
  }

  return (
    <div className="p-3 flex flex-col h-full">
      <form onSubmit={handleSearch} className="mb-3">
        <div className="flex gap-1">
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="submit" disabled={loading || !query.trim()} className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-1">
            {loading ? <Loader size={14} className="animate-spin" /> : <Search size={14} />}
          </button>
          <button type="button" onClick={handleClear} disabled={loading || (!query.trim() && !searchResults)} className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:text-gray-400 disabled:bg-gray-100 transition-colors">
            <X size={14} />
          </button>
        </div>
      </form>

      {renderResults()}
    </div>
  );
}
