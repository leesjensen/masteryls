import React, { useState } from 'react';

// Example users data. Replace with your actual users data source.
const users = [
  { id: 1, name: 'Alice Johnson' },
  { id: 2, name: 'Bob Smith' },
  { id: 3, name: 'Charlie Lee' },
  { id: 4, name: 'Dana White' },
  { id: 5, name: 'Emily Davis' },
  { id: 6, name: 'Frank Miller' },
  { id: 7, name: 'Grace Chen' },
  { id: 8, name: 'Henry Wilson' },
  { id: 9, name: 'Isabella Garcia' },
  { id: 10, name: 'Jack Thompson' },
  { id: 11, name: 'Karen Rodriguez' },
  { id: 12, name: 'Luis Martinez' },
  { id: 13, name: 'Maria Gonzalez' },
  { id: 14, name: 'Nathan Brown' },
];

export default function UserSelect({ onSubmit, showSelectedOnly = false }) {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [nameFilter, setNameFilter] = useState('');
  const [viewMode, setViewMode] = useState('all'); // 'all', 'selected'

  const handleUserToggle = (userId) => {
    setSelectedUsers((prev) => {
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
            All Users
          </button>
          <button type="button" onClick={() => setViewMode('selected')} disabled={selectedUsers.length === 0} className={`px-3 py-1 text-xs rounded transition ${viewMode === 'selected' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400'}`}>
            Selected Only ({selectedUsers.length})
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

      <button type="submit" disabled={selectedUsers.length === 0} className="w-full bg-blue-600 text-white py-2 text-sm rounded hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed">
        Submit
      </button>
    </form>
  );
}
