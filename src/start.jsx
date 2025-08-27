import React, { useEffect, useState } from 'react';
import Login from './login.jsx';

const stockImages = {
  hero: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1471&h=980',
  personalized: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&h=980',
  instructors: 'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1469&h=980',
  progress: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&h=980',
  contact: 'https://images.unsplash.com/photo-1423666639041-f56000c27a9a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1473&h=980',
};

const Start = ({ setUser }) => {
  const [scrollY, setScrollY] = useState(0);
  const [displayLogin, setDisplayLogin] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const login = () => {
    setDisplayLogin(true);
  };

  const loginResult = (user) => {
    if (user) {
      setUser(user);
    }
    setDisplayLogin(false);
  };

  if (displayLogin) {
    return <Login setUser={loginResult} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <section className="relative flex items-center justify-between px-8 py-20 max-w-7xl mx-auto" style={{ transform: `translateY(${scrollY * 0.5}px)` }}>
        <div className="flex-1 pr-8">
          <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">Master Your Learning Journey</h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">Transform your educational experience with our cutting-edge learning system</p>
          <button onClick={login} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-8 rounded-lg transition-colors duration-300 shadow-lg">
            Login / Register
          </button>
        </div>
        <div className="flex-1">
          <img src={stockImages.hero} alt="Learning illustration" className="w-full h-auto rounded-lg shadow-xl" />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white" style={{ transform: `translateY(${scrollY * 0.2}px)` }}>
        <div className="max-w-7xl mx-auto px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">Why Choose Mastery LS?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-50 rounded-lg p-8 shadow-md hover:shadow-lg transition-shadow duration-300">
              <img src={stockImages.personalized} alt="Personalized learning" className="w-full h-48 object-cover rounded-lg mb-6" />
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">Personalized Learning</h3>
              <p className="text-gray-600 leading-relaxed">AI-powered curriculum that adapts to your unique learning style and pace.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-8 shadow-md hover:shadow-lg transition-shadow duration-300">
              <img src={stockImages.instructors} alt="Expert instructors" className="w-full h-48 object-cover rounded-lg mb-6" />
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">Expert Instructors</h3>
              <p className="text-gray-600 leading-relaxed">Learn from industry professionals with real-world experience.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-8 shadow-md hover:shadow-lg transition-shadow duration-300">
              <img src={stockImages.progress} alt="Progress tracking" className="w-full h-48 object-cover rounded-lg mb-6" />
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">Progress Tracking</h3>
              <p className="text-gray-600 leading-relaxed">Detailed analytics to monitor your learning journey and achievements.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-indigo-600" style={{ transform: `translateY(${scrollY * 0.1}px)` }}>
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div className="text-white">
              <h3 className="text-4xl font-bold mb-2">50,000+</h3>
              <p className="text-indigo-200 text-lg">Active Learners</p>
            </div>
            <div className="text-white">
              <h3 className="text-4xl font-bold mb-2">1,200+</h3>
              <p className="text-indigo-200 text-lg">Courses Available</p>
            </div>
            <div className="text-white">
              <h3 className="text-4xl font-bold mb-2">95%</h3>
              <p className="text-indigo-200 text-lg">Success Rate</p>
            </div>
            <div className="text-white">
              <h3 className="text-4xl font-bold mb-2">24/7</h3>
              <p className="text-indigo-200 text-lg">Support Available</p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">Get In Touch</h2>
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-8">
              <h3 className="text-2xl font-semibold text-gray-900 mb-8">Contact Information</h3>
              <div className="space-y-4">
                <div className="flex">
                  <span className="font-semibold text-gray-700 w-20">Email:</span>
                  <span className="text-gray-600">support@masteryls.com</span>
                </div>
                <div className="flex">
                  <span className="font-semibold text-gray-700 w-20">Phone:</span>
                  <span className="text-gray-600">(555) 123-4567</span>
                </div>
                <div className="flex">
                  <span className="font-semibold text-gray-700 w-20">Address:</span>
                  <span className="text-gray-600">123 Learning Street, Education City, EC 12345</span>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <img src={stockImages.contact} alt="Contact us" className="w-full h-auto rounded-lg shadow-lg" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-8">
          <p className="text-center text-gray-400">&copy; 2024 Mastery LS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Start;
