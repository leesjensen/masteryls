import React, { useEffect, useState } from 'react';
import Login from './login.jsx';
import { useNavigate } from 'react-router-dom';
import { updateAppBar } from './hooks/useAppBarState';

const stockImages = {
  hero: 'masteryls-hero.avif',
  instruction: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80',
  aiLearning: 'https://images.unsplash.com/photo-1513258496099-48168024aec0?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80',
  aiContent: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&h=980',
  personalized: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&h=980',
  collaboration: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1471&h=980',
  progress: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&h=980',
  versionControl: 'https://images.unsplash.com/photo-1556075798-4825dfaaf498?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1476&h=980',
  contact: 'https://images.unsplash.com/photo-1423666639041-f56000c27a9a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1473&h=980',
};

const Start = ({ courseOps }) => {
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    updateAppBar({ title: 'Get started', tools: null });
  }, []);

  useEffect(() => {
    const c = courseOps.courseCatalog() || [];
    setCatalog(c);
  }, [courseOps]);

  const scrollToCatalog = () => {
    const el = document.getElementById('catalog-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div>
      <section className="relative flex justify-between mx-auto py-0 bg-gradient-to-br from-amber-50 to-amber-200">
        <div className="flex-1 px-8 md:justify-items-end">
          <div className="flex flex-row pt-2">
            <img src="/favicon.png" alt="Mastery LS Logo" className="w-16 h-auto mb-6 mr-2" />
            <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
              <span className="text-[#20508b]">Mastery</span>
              <span className="text-[#3dbcab]">LS</span>
            </h1>
          </div>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed md:text-right max-w-[600px]">Power your learning with AI-driven insights, expert content, and experiential projects.</p>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed md:text-right max-w-[600px]">
            Login to learn, or browse the{' '}
            <button onClick={scrollToCatalog} className="text-amber-700 font-semibold hover:text-amber-600">
              catalog
            </button>{' '}
            without an account.
          </p>
          <Login courseOps={courseOps} />
        </div>
        <div className="flex-1 hidden md:block h-[48rem] relative">
          <img src={stockImages.hero} alt="Learning illustration" className="absolute inset-0 w-full h-full object-cover shadow-xl" style={{ objectPosition: 'center' }} />
        </div>
      </section>

      {catalog.length > 0 && (
        <section id="catalog-section" className="py-16 bg-amber-50">
          <div className="max-w-7xl mx-auto px-8">
            <h2 className="text-4xl font-bold text-center text-gray-900 mb-8">Try a course</h2>

            <div className="max-w-xl mx-auto">
              <label className="block text-xl font-medium text-gray-800 mb-4">
                Browse a course without creating an account. Register to use <b>AI learning</b>, track <b>progress</b>, and earn <b>credentials</b>.
              </label>

              <div role="listbox" aria-label="Courses" tabIndex={0} className="w-full rounded-md border border-gray-300 shadow-sm bg-white overflow-y-auto max-h-[500px]">
                {catalog.map((entry) => (
                  <CourseEntry key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">Take a tour with us</h2>
          <iframe width="560" height="315" src="https://www.youtube.com/embed/HXNx_Gp0jyM" title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen></iframe>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">Why Learn with Mastery LS?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <PromoCard image={stockImages.instruction} title="Expert Instruction" description="Industry professionals with decades of experience." />
            <PromoCard image={stockImages.aiLearning} title="AI Adaptive Learning" description="AI-powered mentoring, feedback, personalized learning paths, and adaptive assessments." />
            <PromoCard image={stockImages.personalized} title="Experiential Projects" description="Curriculum that focuses on real-world projects to enhance learning outcomes." />
            <PromoCard image={stockImages.collaboration} title="Collaboration" description="Tools and features that enhance teamwork and communication with instructors, mentors, peers, and AI bots." />
            <PromoCard image={stockImages.aiContent} title="AI Content Generation" description="AI-powered course, topic, quiz, and feedback generation." />
            <PromoCard image={stockImages.progress} title="Progress Tracking" description="Detailed analytics to monitor your learning journey and achievements." />
            <PromoCard image={stockImages.versionControl} title="GitHub based content management" description="Full version history, branching, and collaboration features powered by GitHub." />
          </div>
        </div>
      </section>

      <section className="py-16 bg-amber-600">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div className="text-white">
              <h3 className="text-4xl font-bold mb-2">500+</h3>
              <p className="text-amber-200 text-lg">Active Learners</p>
            </div>
            <div className="text-white">
              <h3 className="text-4xl font-bold mb-2">{catalog.length}</h3>
              <p className="text-amber-200 text-lg">Courses Available</p>
            </div>
            <div className="text-white">
              <h3 className="text-4xl font-bold mb-2">89%</h3>
              <p className="text-amber-200 text-lg">Success Rate</p>
            </div>
            <div className="text-white">
              <h3 className="text-4xl font-bold mb-2">16</h3>
              <p className="text-amber-200 text-lg">Mentors Online</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-amber-50 mb-10">
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
            <div className="flex-1 hidden sm:block">
              <img src={stockImages.contact} alt="Contact us" className="w-full h-auto rounded-lg shadow-lg" />
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-gray-600 py-8">
        <div className="max-w-7xl mx-auto px-8">
          <p className="text-center text-gray-200">&copy; 2025 Mastery LS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

function PromoCard({ image, title, description }) {
  return (
    <div className="bg-amber-50 rounded-lg p-8 shadow-md hover:shadow-lg transition-shadow duration-300">
      <img src={image} alt={title} className="w-full h-48 object-cover rounded-lg mb-6 hover:scale-103 transition-transform duration-300" />
      <h3 className="text-2xl font-semibold text-gray-900 mb-4">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

function CourseEntry({ entry }) {
  const navigate = useNavigate();
  return (
    <div
      role="option"
      onClick={() => {
        navigate(`/course/${entry.id}`);
      }}
      className={'cursor-pointer px-4 py-3 border-b last:border-b-0 transition-colors duration-150 hover:bg-amber-200'}
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold text-amber-600">{entry.title}</div>
        <div className="text-sm text-gray-500">{entry.duration || ''}</div>
      </div>
      {entry.description && <div className="text-sm text-gray-600 mt-1">{entry.description}</div>}
    </div>
  );
}

export default Start;
