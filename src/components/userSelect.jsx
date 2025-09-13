import React, { useState, useEffect } from 'react';

export default function UserSelect({ users, onSubmit, showSelectedOnly = false, selected = [], setSelected }) {
  const [nameFilter, setNameFilter] = useState('');
  const [viewMode, setViewMode] = useState(showSelectedOnly ? 'selected' : 'all');

  const [internalSelected, setInternalSelected] = useState(selected);

  useEffect(() => {
    setInternalSelected(selected);
  }, [selected]);

  const handleUserToggle = (userId) => {
    setInternalSelected((prev) => {
      let result;
      if (prev.includes(userId)) {
        result = prev.filter((id) => id !== userId);
      } else {
        result = [...prev, userId];
      }
      if (setSelected) {
        setSelected(result);
      }
      return result;
    });
  };

  const getFilteredUsers = () => {
    let filtered = users;

    // Filter by name if there's a search term
    if (nameFilter.trim()) {
      filtered = filtered.filter((user) => user.name.toLowerCase().includes(nameFilter.toLowerCase()));
    }

    // Filter by view mode
    if (viewMode === 'selected') {
      filtered = filtered.filter((user) => internalSelected.includes(user.id));
    }

    return filtered;
  };

  const filteredUsers = getFilteredUsers();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (internalSelected.length > 0 && onSubmit) {
      onSubmit(internalSelected);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-4 bg-white rounded-lg shadow-md">
      {/* Search and View Controls */}
      <div className="mb-3 space-y-2">
        <input type="text" placeholder="Filter by name..." value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <div className="flex gap-2">
          <button type="button" onClick={() => setViewMode('all')} className={`px-3 py-1 text-xs rounded transition ${viewMode === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
            All
          </button>
          <button type="button" onClick={() => setViewMode('selected')} disabled={internalSelected.length === 0} className={`px-3 py-1 text-xs rounded transition ${viewMode === 'selected' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400'}`}>
            Selected ({internalSelected.length})
          </button>
        </div>
      </div>

      {/* User List */}
      <div className="max-h-64 overflow-y-auto mb-3 border border-gray-200 rounded">
        {filteredUsers.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {filteredUsers.map((user) => (
              <label key={user.id} className="flex items-center px-3 py-0.5 cursor-pointer hover:bg-gray-50 transition">
                <input type="checkbox" checked={internalSelected.includes(user.id)} onChange={() => handleUserToggle(user.id)} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3" />
                <span className="text-sm text-gray-800 flex-grow">{user.name}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-gray-500 text-sm">{viewMode === 'selected' && internalSelected.length === 0 ? 'No users selected' : nameFilter.trim() ? 'No users match your search' : 'No users available'}</div>
        )}
      </div>

      {/* Selection Summary */}
      <div className="text-xs text-gray-600 mb-3">
        {internalSelected.length > 0 ? `${internalSelected.length} user${internalSelected.length > 1 ? 's' : ''} selected` : 'No users selected'}
        {filteredUsers.length < users.length && (
          <span className=" ml-2">
            • Showing {filteredUsers.length} of {users.length} users
          </span>
        )}
      </div>

      {onSubmit && (
        <button type="submit" className="w-full bg-blue-600 text-white py-2 text-sm rounded hover:bg-blue-700 transition">
          Submit
        </button>
      )}
    </form>
  );
}
