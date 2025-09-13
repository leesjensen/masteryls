import React, { useState } from 'react';

export default function UserSelect({ users, onSubmit, showSelectedOnly = false, selected = [], setSelected }) {
  const [nameFilter, setNameFilter] = useState('');
  const [viewMode, setViewMode] = useState(showSelectedOnly ? 'selected' : 'all');

  // Use controlled state if setSelected is provided, otherwise use internal state
  const [internalSelected, setInternalSelected] = useState([]);
  const selectedUsers = setSelected ? selected : internalSelected;
  const updateSelectedUsers = setSelected || setInternalSelected;

  const handleUserToggle = (userId) => {
    updateSelectedUsers((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      } else {
        return [...prev, userId];
      }
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
      filtered = filtered.filter((user) => selectedUsers.includes(user.id));
    }

    // Limit to maximum 10 users for display
    return filtered.slice(0, 10);
  };

  const filteredUsers = getFilteredUsers();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedUsers.length > 0 && onSubmit) {
      onSubmit(selectedUsers);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-3 text-gray-800">Select Users</h2>

      {/* Search and View Controls */}
      <div className="mb-3 space-y-2">
        <input type="text" placeholder="Filter by name..." value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <div className="flex gap-2">
          <button type="button" onClick={() => setViewMode('all')} className={`px-3 py-1 text-xs rounded transition ${viewMode === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
            All
          </button>
          <button type="button" onClick={() => setViewMode('selected')} disabled={selectedUsers.length === 0} className={`px-3 py-1 text-xs rounded transition ${viewMode === 'selected' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400'}`}>
            Selected ({selectedUsers.length})
          </button>
        </div>
      </div>

      {/* User List */}
      <div className="max-h-64 overflow-y-auto mb-3 border border-gray-200 rounded">
        {filteredUsers.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {filteredUsers.map((user) => (
              <label key={user.id} className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50 transition">
                <input type="checkbox" checked={selectedUsers.includes(user.id)} onChange={() => handleUserToggle(user.id)} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3" />
                <span className="text-sm text-gray-800 flex-grow">{user.name}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-gray-500 text-sm">{viewMode === 'selected' && selectedUsers.length === 0 ? 'No users selected' : nameFilter.trim() ? 'No users match your search' : 'No users available'}</div>
        )}
      </div>

      {/* Selection Summary */}
      <div className="text-xs text-gray-600 mb-3">
        {selectedUsers.length > 0 ? `${selectedUsers.length} user${selectedUsers.length > 1 ? 's' : ''} selected` : 'No users selected'}
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
