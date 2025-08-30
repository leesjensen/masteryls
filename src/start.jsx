import React, { useEffect, useState } from 'react';
import Login from './login.jsx';

const stockImages = {
  hero: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1471&h=980',
  instruction: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?ixlib=rb-4.0.3&auto=format&fit=crop&w=1469&h=980',
  aiLearning: 'https://images.unsplash.com/photo-1513258496099-48168024aec0?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80',
  aiContent: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&h=980',
  personalized: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&h=980',
  collaboration: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1471&h=980',
  progress: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&h=980',
  versionControl: 'https://images.unsplash.com/photo-1556075798-4825dfaaf498?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1476&h=980',
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
    <div className='min-h-screen bg-gradient-to-br from-amber-50 to-amber-200'>
      <section className='relative flex items-center justify-between max-w-7xl mx-auto md:py-0 py-4' style={{ transform: `translateY(${scrollY * 0.3}px)` }}>
        <div className='flex-1 px-8'>
          <div className='flex flex-row'>
            <img src='/favicon.svg' alt='Mastery LS Logo' className='w-16 h-auto mb-6 mr-2' />
            <h1 className='text-5xl font-bold text-gray-900 mb-6 leading-tight'>Mastery LS</h1>
          </div>
          <p className='text-xl text-gray-600 mb-8 leading-relaxed'>Master life long learning with AI, world class content, experiential projects, and peer collaboration</p>
          <button onClick={login} className='bg-amber-600 hover:bg-amber-700 text-white font-semibold py-4 px-8 rounded-lg transition-colors duration-300 shadow-lg'>
            Login / Register
          </button>
        </div>
        <div className='flex-1 hidden md:block h-[32rem] relative'>
          <img src={stockImages.hero} alt='Learning illustration' className='absolute inset-0 w-full h-full object-cover shadow-xl' style={{ objectPosition: 'center' }} />
        </div>
      </section>

      <section className='py-32 bg-white mb-20' style={{ transform: `translateY(${scrollY * 0.15}px)` }}>
        <div className='max-w-7xl mx-auto px-8'>
          <h2 className='text-4xl font-bold text-center text-gray-900 mb-16'>Why Learn with Mastery LS?</h2>
          <div className='grid md:grid-cols-3 gap-8'>
            <PromoCard image={stockImages.instruction} title='Expert Instruction' description='Industry professionals with decades of experience.' />
            <PromoCard image={stockImages.aiLearning} title='AI Adaptive Learning' description='AI-powered mentoring, feedback, personalized learning paths, and adaptive assessments.' />
            <PromoCard image={stockImages.personalized} title='Experiential Projects' description='Curriculum that focuses on real-world projects to enhance learning outcomes.' />
            <PromoCard
              image={stockImages.collaboration}
              title='Collaboration'
              description='Tools and features that enhance teamwork and communication with instructors, mentors, peers, and AI bots.'
            />
            <PromoCard image={stockImages.aiContent} title='AI Content Generation' description='AI-powered course, topic, quiz, and feedback generation.' />
            <PromoCard image={stockImages.progress} title='Progress Tracking' description='Detailed analytics to monitor your learning journey and achievements.' />
            <PromoCard image={stockImages.versionControl} title='GitHub based content management' description='Full version history, branching, and collaboration features powered by GitHub.' />
          </div>
        </div>
      </section>

      <section className='py-32 bg-amber-600 mb-20' style={{ transform: `translateY(${scrollY * 0.05}px)` }}>
        <div className='max-w-7xl mx-auto px-8'>
          <div className='grid md:grid-cols-4 gap-8 text-center'>
            <div className='text-white'>
              <h3 className='text-4xl font-bold mb-2'>500+</h3>
              <p className='text-amber-200 text-lg'>Active Learners</p>
            </div>
            <div className='text-white'>
              <h3 className='text-4xl font-bold mb-2'>3</h3>
              <p className='text-amber-200 text-lg'>Courses Available</p>
            </div>
            <div className='text-white'>
              <h3 className='text-4xl font-bold mb-2'>89%</h3>
              <p className='text-amber-200 text-lg'>Success Rate</p>
            </div>
            <div className='text-white'>
              <h3 className='text-4xl font-bold mb-2'>16</h3>
              <p className='text-amber-200 text-lg'>Mentors Available</p>
            </div>
          </div>
        </div>
      </section>

      <section className='py-20 bg-amber-50 mb-10'>
        <div className='max-w-7xl mx-auto px-8'>
          <h2 className='text-4xl font-bold text-center text-gray-900 mb-16'>Get In Touch</h2>
          <div className='flex items-center justify-between'>
            <div className='flex-1 pr-8'>
              <h3 className='text-2xl font-semibold text-gray-900 mb-8'>Contact Information</h3>
              <div className='space-y-4'>
                <div className='flex'>
                  <span className='font-semibold text-gray-700 w-20'>Email:</span>
                  <span className='text-gray-600'>support@masteryls.com</span>
                </div>
                <div className='flex'>
                  <span className='font-semibold text-gray-700 w-20'>Phone:</span>
                  <span className='text-gray-600'>(555) 123-4567</span>
                </div>
                <div className='flex'>
                  <span className='font-semibold text-gray-700 w-20'>Address:</span>
                  <span className='text-gray-600'>123 Learning Street, Education City, EC 12345</span>
                </div>
              </div>
            </div>
            <div className='flex-1'>
              <img src={stockImages.contact} alt='Contact us' className='w-full h-auto rounded-lg shadow-lg' />
            </div>
          </div>
        </div>
      </section>

      <footer className='bg-gray-900 py-8'>
        <div className='max-w-7xl mx-auto px-8'>
          <p className='text-center text-gray-200'>&copy; 2025 Mastery LS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

function PromoCard({ image, title, description }) {
  return (
    <div className='bg-amber-50 rounded-lg p-8 shadow-md hover:shadow-lg transition-shadow duration-300'>
      <img src={image} alt={title} className='w-full h-48 object-cover rounded-lg mb-6 hover:scale-103 transition-transform duration-300' />
      <h3 className='text-2xl font-semibold text-gray-900 mb-4'>{title}</h3>
      <p className='text-gray-600 leading-relaxed'>{description}</p>
    </div>
  );
}

export default Start;
