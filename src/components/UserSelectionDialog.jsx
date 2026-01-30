import React, { useState, useRef, useEffect } from 'react';

/**
 * Generic user selection dialog component
 *
 * This component provides a reusable interface for selecting users for various purposes
 * such as editors, mentors, cohorts, or root users. It handles user search, selection,
 * and displays both current and available users.
 *
 * Example usage for different roles:
 *
 * // For editors:
 * <UserSelectionDialog
 *   title="Manage editors"
 *   currentUsersLabel="Current editors"
 *   fetchCurrentUsers={() => service.getEditorsForCourse(courseId)}
 *   searchUsers={(query) => service.searchUsers(query, 25)}
 *   ...
 * />
 *
 * // For mentors:
 * <UserSelectionDialog
 *   title="Manage mentors"
 *   currentUsersLabel="Current mentors"
 *   fetchCurrentUsers={() => service.getMentorsForCourse(courseId)}
 *   searchUsers={(query) => service.searchUsers(query, 25)}
 *   ...
 * />
 *
 * // For cohort members:
 * <UserSelectionDialog
 *   title="Manage cohort members"
 *   currentUsersLabel="Cohort members"
 *   fetchCurrentUsers={() => service.getCohortMembers(cohortId)}
 *   searchUsers={(query) => service.searchUsers(query, 25)}
 *   allowEmpty={true}
 *   ...
 * />
 *
 * @param {Object} props
 * @param {string} props.title - Dialog title
 * @param {string} props.description - Dialog description
 * @param {string} props.currentUsersLabel - Label for current users section
 * @param {string} props.searchUsersLabel - Label for search users section
 * @param {Array} props.selectedUserIds - Array of currently selected user IDs
 * @param {Function} props.onSelectionChange - Callback when selection changes
 * @param {Function} props.fetchCurrentUsers - Async function to fetch current users for the role
 * @param {Function} props.searchUsers - Async function to search users
 * @param {boolean} props.isOpen - Whether dialog is open
 * @param {Function} props.onOpen - Callback when dialog opens
 * @param {Function} props.onClose - Callback when dialog closes
 * @param {boolean} props.allowEmpty - Whether to allow empty selection (default: false)
 * @param {Function} props.isOriginalUser - Function to check if user was originally in the list
 * @param {Function} props.onUsersLoaded - Callback when users are loaded (receives users array and Map)
 * @param {Map} props.initialKnownUsers - Optional initial user data Map to avoid redundant fetching
 */
export default function UserSelectionDialog({ title = 'Manage users', description = 'Add or remove users. Changes are saved when you click Save changes.', currentUsersLabel = 'Current users', searchUsersLabel = 'Find users', selectedUserIds = [], onSelectionChange, fetchCurrentUsers, searchUsers, isOpen, onOpen, onClose, allowEmpty = false, onUsersLoaded, isOriginalUser = () => false, initialKnownUsers = null }) {
  const dialogRef = useRef(null);
  const hasLoadedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [knownUsers, setKnownUsers] = useState(initialKnownUsers || new Map());

  // Sync knownUsers when initialKnownUsers changes
  useEffect(() => {
    if (initialKnownUsers && initialKnownUsers.size > 0) {
      setKnownUsers(initialKnownUsers);
    }
  }, [initialKnownUsers]);

  // Fetch current users when dialog opens (only if not provided via initialKnownUsers)
  useEffect(() => {
    if (!isOpen) {
      // Reset when dialog closes so next open will fetch fresh data
      hasLoadedRef.current = false;
      return;
    }

    // Skip if we have initial data or already loaded
    if (initialKnownUsers || hasLoadedRef.current) {
      hasLoadedRef.current = true;
      return;
    }

    const loadUsers = async () => {
      setLoading(true);
      try {
        const users = await fetchCurrentUsers();
        const usersMap = new Map();
        users.forEach((user) => usersMap.set(user.id, user));
        setKnownUsers(usersMap);
        // Notify parent component of loaded users
        if (onUsersLoaded) {
          onUsersLoaded(users, usersMap);
        }
        hasLoadedRef.current = true;
      } catch (error) {
        console.error('Failed to load users:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [isOpen, initialKnownUsers]); // Depend on isOpen and initialKnownUsers

  // Search users with debounce
  useEffect(() => {
    if (!isOpen) return;

    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length < 2) {
      setSearchResults([]);
      setSearchError('');
      setSearchLoading(false);
      return;
    }

    const handle = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError('');
      try {
        const results = await searchUsers(trimmedQuery);
        setSearchResults(results);
        setKnownUsers((prev) => {
          const next = new Map(prev);
          results.forEach((result) => next.set(result.id, result));
          return next;
        });
      } catch (error) {
        setSearchError(error.message || 'Failed to search users');
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [searchQuery, isOpen, searchUsers]);

  const handleOpen = () => {
    dialogRef.current?.showModal();
    onOpen?.();
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError('');
    dialogRef.current?.close();
    onClose?.();
  };

  const toggleSelection = (userId) => {
    const newSelection = selectedUserIds.includes(userId) ? selectedUserIds.filter((id) => id !== userId) : [...selectedUserIds, userId];
    onSelectionChange?.(newSelection);
  };

  const selectedUsers = selectedUserIds.map((id) => knownUsers.get(id)).filter(Boolean);
  const selectedCount = selectedUserIds.length;

  // Open/close dialog based on isOpen prop
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  return (
    <>
      <dialog ref={dialogRef} className="w-full p-6 rounded-lg shadow-xl max-w-3xl mt-20 mx-auto" onCancel={handleClose}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
          <button type="button" onClick={handleClose} className="text-sm text-gray-500 hover:text-gray-700">
            Close
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-700">{currentUsersLabel}</h4>
              <span className="text-xs text-gray-500">{selectedCount} total</span>
            </div>
            <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto bg-white">
              {loading ? (
                <div className="p-4 text-sm text-gray-500">Loading users…</div>
              ) : selectedUsers.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {selectedUsers.map((user) => (
                    <li key={user.id} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <div className="text-sm text-gray-800">{user.name}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                        {!isOriginalUser(user.id) && <span className="text-[10px] uppercase text-blue-600">New</span>}
                      </div>
                      <button type="button" onClick={() => toggleSelection(user.id)} disabled={!allowEmpty && selectedCount <= 1} className="text-xs text-red-600 hover:text-red-700 disabled:text-gray-300">
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-4 text-sm text-gray-500">No users selected.</div>
              )}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">{searchUsersLabel}</h4>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name or email" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <div className="mt-2 border border-gray-200 rounded-lg max-h-64 overflow-y-auto bg-white">
              {searchLoading ? (
                <div className="p-4 text-sm text-gray-500">Searching…</div>
              ) : searchError ? (
                <div className="p-4 text-sm text-red-600">{searchError}</div>
              ) : searchQuery.trim().length < 2 ? (
                <div className="p-4 text-sm text-gray-500">Type at least 2 characters to search.</div>
              ) : searchResults.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {searchResults.map((result) => {
                    const isSelected = selectedUserIds.includes(result.id);
                    return (
                      <li key={result.id} className="flex items-center justify-between px-3 py-2">
                        <div>
                          <div className="text-sm text-gray-800">{result.name}</div>
                          <div className="text-xs text-gray-500">{result.email}</div>
                        </div>
                        <button type="button" onClick={() => toggleSelection(result.id)} className={`text-xs ${isSelected ? 'text-gray-500' : 'text-blue-600 hover:text-blue-700'}`}>
                          {isSelected ? 'Added' : 'Add'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="p-4 text-sm text-gray-500">No users match your search.</div>
              )}
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
