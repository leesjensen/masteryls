import React, { useState, useRef, useEffect } from 'react';
import { useAppBarState } from './hooks/useAppBarState';
import { useNavigate, useLocation } from 'react-router-dom';
import { SquareStar, Columns3Cog, ChartArea, LogOut } from 'lucide-react';

export function AppBar({ user, courseOps }) {
  const { title, subTitle, tools } = useAppBarState();
  const navigate = useNavigate();
  const location = useLocation();

  function renderTitle(title, subTitle) {
    let titleComponent = <span>{title}</span>;
    if (location.pathname.startsWith('/course/')) {
      const courseId = location.pathname.split('/')[2];
      titleComponent = (
        <span onClick={() => navigate(`/course/${courseId}`)} className="cursor-pointer hover:underline text-blue-600 hover:text-blue-800">
          {title}
        </span>
      );
    }

    return (
      <>
        {titleComponent}
        {subTitle && (
          <>
            <span className="mx-1 text-gray-400">/</span>
            <span className="text-gray-700">{subTitle}</span>
          </>
        )}
      </>
    );
  }

  function navigateHome() {
    let path = user ? '/dashboard' : '/';
    if (user) {
      if (location.pathname.startsWith('/course/')) path = '/dashboard';
    }
    return (
      <img
        src="/favicon.png"
        alt="MasteryLS logo"
        className=" w-[20px] h-[20px] cursor-pointer"
        onClick={() => {
          courseOps.setCurrentCourse(null);
          navigate(path);
        }}
      />
    );
  }

  return (
    <header className="flex flex-row items-center justify-between pr-2 border-b-1 bg-gray-50 border-gray-500 h-[42px]">
      <h1 className="pl-1 font-medium text-lg text-gray-900 flex items-center min-w-0">
        <span className="hidden sm:inline-flex items-center justify-center bg-white border border-gray-300 rounded-full w-[32px] h-[32px] ml-1 mr-2">{navigateHome()}</span> <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">{renderTitle(title, subTitle)}</span>
      </h1>
      <div className="flex items-center gap-2">
        <div className="whitespace-nowrap ml-2">{tools}</div>
        <UserMenu user={user} courseOps={courseOps} />
      </div>
    </header>
  );
}

export function AppBarButton({ icon: Icon, onClick, title = undefined, size = 18 }) {
  return (
    <button title={title} onClick={onClick} className="bg-transparent border border-gray-50  hover:text-amber-600 transition-all duration-200 ease-in-out">
      <Icon size={size} />
    </button>
  );
}

function AppBarMenuItem({ icon: Icon, onClick, title }) {
  return (
    <button onClick={onClick} className="w-full text-left px-4 py-1 text-sm text-gray-700  hover:text-amber-600 flex items-center gap-2">
      <Icon size={16} />
      {title}
    </button>
  );
}

function UserMenu({ user, courseOps }) {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  function getUserInitials(value) {
    const normalized = (value || '').trim();
    if (!normalized) return '?';

    const parts = normalized.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }

    const single = parts[0];
    if (single.includes('@')) {
      return single[0].toUpperCase();
    }

    return single.slice(0, 2).toUpperCase();
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMenuOpen]);

  const handleMenuItemClick = (action) => {
    setIsMenuOpen(false);
    action();
  };

  if (user) {
    const initials = getUserInitials(user.name || user.email);

    return (
      <div className="relative" ref={menuRef}>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="w-7 h-7 bg-white rounded-full border-1 border-gray-600 hover:border-amber-600 hover:bg-amber-50 hover:text-amber-600 transition-all duration-200 ease-in-out flex items-center justify-center" title="User Menu" aria-label="User Menu">
          <span className="text-xs font-medium leading-none select-none">{initials}</span>
        </button>

        {isMenuOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
            <div className="flex items-center gap-2 w-full text-left px-4 py-2 text-md font-medium text-amber-600">{user.name}</div>
            <div className="border-t border-gray-200 my-1"></div>
            <AppBarMenuItem icon={SquareStar} onClick={() => handleMenuItemClick(() => navigate('/dashboard'))} title="Dashboard" />
            <AppBarMenuItem icon={Columns3Cog} onClick={() => handleMenuItemClick(() => navigate('/metrics'))} title="Metrics" />
            <AppBarMenuItem icon={ChartArea} onClick={() => handleMenuItemClick(() => navigate('/progress'))} title="Activity" />
            <div className="border-t border-gray-200 my-1"></div>
            <AppBarMenuItem
              icon={LogOut}
              onClick={() =>
                handleMenuItemClick(() => {
                  navigate('/');
                  courseOps.logout();
                })
              }
              title="Logout"
            />
          </div>
        )}
      </div>
    );
  }

  return null;
}
