import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';

export default function SearchCourse({ courseOps, learningSession }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const searchResults = await courseOps.searchCourse(query);
      setResults(searchResults || []);
    } catch (err) {
      setError('Failed to search. Please try again.');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }

  function viewResult(result) {
    console.log(result);

    navigate(`/course/${learningSession.course.id}/topic/${result.topic.id}`);
  }

  function renderResults() {
    if (error) return <div className="text-red-600 text-xs mb-3">{error}</div>;
    if (results && results.length === 0) {
      return <div className="text-gray-500 text-xs">No results found</div>;
    } else if (results) {
      return (
        <div className="flex-1 overflow-auto">
          <div className="text-gray-600 text-xs mb-2">
            {results.length} matching topic{results.length !== 1 ? 's' : ''}
          </div>

          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((result, idx) => (
                <div key={idx} className="border border-gray-200 rounded-md p-2 bg-white">
                  <div className="font-semibold text-xs text-gray-900">{result.topic.title}</div>
                  {result.matches && result.matches.length > 0 && (
                    <div className="space-y-1 mt-1">
                      {result.matches.map((match, midx) => (
                        <div key={midx} className="text-xs text-gray-700 px-1.5" onClick={() => viewResult(result)}>
                          {match}
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
          <button type="submit" disabled={loading} className="w-40 px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-1">
            {loading ? <Loader size={14} className="animate-spin" /> : 'Search'}
          </button>
        </div>
      </form>

      {renderResults()}
    </div>
  );
}
