import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement, Filler } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { updateAppBar } from '../../hooks/useAppBarState';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement, Filler);

const last24Hours = () => {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date;
};

export default function MetricsView({ courseOps }) {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState(last24Hours());
  const [endDate, setEndDate] = useState(new Date());
  const [selectedCourseId, setSelectedCourseId] = useState('');

  // Get course catalog for course filter
  const courseCatalog = courseOps.courseCatalog();

  // Helper function to validate custom date range
  const validateDateRange = () => {
    if (!startDate && !endDate) return true; // Allow empty dates
    if (startDate && endDate) {
      return startDate <= endDate;
    }
    return true;
  };

  // Helper function to set common date ranges
  const setDatePreset = (preset) => {
    switch (preset) {
      case 'today': {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        setStartDate(start);
        const end = new Date();
        setEndDate(end);
        break;
      }
      case 'yesterday': {
        const start = new Date();
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        setStartDate(start);
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);
        setEndDate(end);
        break;
      }
      case 'thisWeek': {
        const start = new Date();
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        setStartDate(start);
        const end = new Date();
        setEndDate(end);
        break;
      }
      case 'thisMonth': {
        let start = new Date();
        start = new Date(start.getFullYear(), start.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        setStartDate(start);
        const end = new Date();
        setEndDate(end);
        break;
      }
      case '24hours': {
        const start = new Date();
        start.setDate(start.getDate() - 1);
        setStartDate(start);
        setEndDate(new Date());
        break;
      }
    }
  };

  const appBarTools = (
    <button title="Close metrics dashboard" onClick={() => navigate('/dashboard')} className="w-6 m-0.5 p-0.5 text-xs font-medium rounded-xs bg-white border border-gray-300 filter grayscale hover:grayscale-0 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out">
      ❌
    </button>
  );

  useEffect(() => {
    updateAppBar('Metrics', appBarTools);
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [startDate, endDate, selectedCourseId]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      // Pass the selected course ID, or null for all courses
      const courseId = selectedCourseId || null;
      const metricsData = await getMetrics(courseId, null, null, startDate, endDate);
      setMetrics(metricsData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-4">
        <div className="text-red-800">
          <h3 className="font-semibold">Error loading metrics</h3>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">No metrics data available</div>
      </div>
    );
  }

  // Helper function to get time range description
  const getTimeRangeDescription = (startDate, endDate) => {
    if (startDate && endDate) {
      const start = startDate.toLocaleDateString();
      const end = endDate.toLocaleDateString();
      if (start === end) {
        return `On ${start}`;
      }
      return `${start} - ${end}`;
    } else if (startDate) {
      return `From ${startDate.toLocaleDateString()}`;
    } else if (endDate) {
      return `Until ${endDate.toLocaleDateString()}`;
    } else {
      return 'All Time';
    }
  };

  // Helper function to get course description
  const getCourseDescription = (courseId) => {
    if (!courseId) return 'All Courses';
    const course = courseCatalog.find((c) => c.id === courseId);
    return course ? course.name : 'Unknown Course';
  };

  const header = (
    <nav className="mb-4 flex flex-col border-0 border-gray-300 bg-white">
      <div className="flex flex-row justify-between">
        <div>
          <p className="my-1 text-sm hidden md:block text-gray-600 mt-1">
            Showing data for: {getCourseDescription(selectedCourseId)} • {getTimeRangeDescription(startDate, endDate)}
            {metrics && <span className="ml-2">({metrics.totalActivities} activities)</span>}
          </p>
        </div>
      </div>
      {/* Date Range and Course Filter Inputs */}
      <div className="flex flex-col space-y-2 bg-white p-4 border border-gray-200">
        <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-2 md:items-center">
          <div className="flex items-center space-x-1">
            <label className="text-sm text-gray-600 w-16 md:w-auto">Course:</label>
            <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-sm min-w-32" title="Filter by course (optional)">
              <option value="">All Courses</option>
              {courseCatalog.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-1">
            <label className="text-sm text-gray-600 w-10 md:w-auto">From:</label>
            <input type="date" value={startDate.toISOString().split('T')[0]} onChange={(e) => setStartDate(new Date(e.target.value))} className="px-2 py-1 border border-gray-300 rounded text-sm" title="Start date (optional)" />
          </div>
          <div className="flex items-center space-x-1">
            <label className="text-sm text-gray-600 w-10 md:w-auto">To:</label>
            <input type="date" value={endDate.toISOString().split('T')[0]} onChange={(e) => setEndDate(new Date(e.target.value))} className="px-2 py-1 border border-gray-300 rounded text-sm" title="End date (optional)" />
          </div>
        </div>
        {/* Quick date presets and course clear */}
        <div className="hidden sm:block">
          <div className="flex flex-wrap gap-1 text-xs">
            <button onClick={() => setDatePreset('24hours')} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700" title="Clear dates">
              Last 24 hours
            </button>
            <button onClick={() => setDatePreset('today')} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700" title="Set to today">
              Today
            </button>
            <button onClick={() => setDatePreset('yesterday')} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700" title="Set to yesterday">
              Yesterday
            </button>
            <button onClick={() => setDatePreset('thisWeek')} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700" title="Set to this week">
              This week
            </button>
            <button onClick={() => setDatePreset('thisMonth')} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700" title="Set to this month">
              This month
            </button>
          </div>
        </div>
        {!validateDateRange() && <span className="text-xs text-red-600">Start date must be before end date</span>}
        {!startDate && !endDate && !selectedCourseId && <span className="text-xs text-gray-500">Leave filters empty for all data</span>}
      </div>
    </nav>
  );

  const dailyLabels = Object.keys(metrics.dailyActivity).sort();

  const generateHourlyData = () => {
    const hourlyData = {};

    const start = startDate ?? metrics.firstActivity;
    const currentDate = new Date(start);
    const end = endDate ?? metrics.lastActivity;

    while (currentDate <= end) {
      const hourKey = currentDate.toISOString().split('T')[0] + ' ' + currentDate.getHours().toString().padStart(2, '0') + ':00';
      hourlyData[hourKey] = metrics.hourlyActivity[hourKey] || 0;
      currentDate.setHours(currentDate.getHours() + 1);
    }

    return hourlyData;
  };

  const completeHourlyData = generateHourlyData();
  const completeHourlyLabels = Object.keys(completeHourlyData).sort();

  const hourlyActivityData = {
    labels: completeHourlyLabels,
    datasets: [
      {
        label: 'Hourly Activities',
        data: completeHourlyLabels.map((hour) => completeHourlyData[hour]),
        borderWidth: 2,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.3)',
        tension: 0.4,
        pointRadius: 0,
        fill: true,
      },
    ],
  };

  const dailyActivityData = {
    labels: dailyLabels,
    datasets: [
      {
        label: 'Daily Activities',
        data: dailyLabels.map((date) => metrics.dailyActivity[date]),
        borderWidth: 2,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.3)',
        tension: 0.4,
        pointRadius: 3,
        fill: true,
      },
    ],
  };

  const activityTypesData = {
    labels: Object.keys(metrics.activityTypes),
    datasets: [
      {
        data: Object.values(metrics.activityTypes),
        backgroundColor: [
          '#EF4444', // Red
          '#10B981', // Green
          '#F59E42', // Orange
          '#6366F1', // Indigo
          '#FBBF24', // Amber
          '#A21CAF', // Violet
          '#22D3EE', // Cyan
          '#F43F5E', // Rose
          '#84CC16', // Lime
          '#F472B6', // Pink
          '#0D9488', // Teal
          '#F87171', // Light Red
          '#FACC15', // Gold
          '#2563EB', // Royal Blue
        ],
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  };

  // Helper function to truncate labels
  const truncateLabel = (label, maxLength = 15) => {
    if (!label) return '';
    return label.length > maxLength ? `${label.substring(0, maxLength)}...` : label;
  };

  const topTopicsData = {
    labels: Object.keys(metrics.topTopics)
      .slice(0, 10)
      .map((label) => truncateLabel(label, 20)), // Top 10 topics with truncated labels
    datasets: [
      {
        label: 'Topic Count',
        data: Object.values(metrics.topTopics).slice(0, 10),
        backgroundColor: 'rgba(16, 16, 200, 0.8)',
        borderColor: 'rgb(16, 16, 129)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {},
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          maxTicksLimit: 10, // Reasonable number of ticks
          maxRotation: 45, // Rotate labels up to 45 degrees
          minRotation: 0,
        },
      },
    },
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: `Top Topics`,
      },
      tooltip: {
        callbacks: {
          title: function (context) {
            // Show full topic name in tooltip
            const originalLabels = Object.keys(metrics.topTopics).slice(0, 10);
            return originalLabels[context[0].dataIndex] || context[0].label;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          maxTicksLimit: 10,
          maxRotation: 45, // Rotate labels up to 45 degrees
          minRotation: 0,
        },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
      },
    },
  };

  async function getMetrics(courseId, enrollmentId, userId, startDate = null, endDate = null) {
    let startDateIso = startDate ? startDate.toISOString() : null;
    let endDateIso = endDate ? endDate.toISOString() : null;
    let progressData = await courseOps.getProgress({ courseId, enrollmentId, userId, startDate: startDateIso, endDate: endDateIso });
    progressData = await enhancedMetrics(progressData);

    const metrics = {
      totalActivities: progressData.length,
      firstActivity: new Date(),
      lastActivity: new Date(),
      activityTypes: {},
      hourlyActivity: {},
      dailyActivity: {},
      weeklyActivity: {},
      averageDuration: 0,
      totalDuration: 0,
      topTopics: {},
      completionTrends: [],
    };

    let totalDurationSum = 0;
    let durationCount = 0;

    progressData.forEach((activity) => {
      const date = new Date(activity.createdAt);
      const day = date.toISOString().split('T')[0];

      if (date < metrics.firstActivity) metrics.firstActivity = date;
      if (date > metrics.lastActivity) metrics.lastActivity = date;

      // Activity types breakdown
      metrics.activityTypes[activity.type] = (metrics.activityTypes[activity.type] || 0) + 1;

      // Hourly activity
      const hour = day + ' ' + date.getHours().toString().padStart(2, '0') + ':00';
      metrics.hourlyActivity[hour] = (metrics.hourlyActivity[hour] || 0) + 1;

      // Daily activity
      metrics.dailyActivity[day] = (metrics.dailyActivity[day] || 0) + 1;

      // Weekly activity
      const week = getWeekNumber(new Date(activity.createdAt));
      metrics.weeklyActivity[week] = (metrics.weeklyActivity[week] || 0) + 1;

      // Duration calculations
      if (activity.duration > 0) {
        totalDurationSum += activity.duration;
        durationCount++;
      }
      metrics.totalDuration += activity.duration || 0;

      // Top topics by count
      metrics.topTopics[activity.topicTitle] = (metrics.topTopics[activity.topicTitle] || 0) + 1;
    });

    metrics.averageDuration = durationCount > 0 ? totalDurationSum / durationCount : 0;

    return metrics;
  }

  async function enhancedMetrics(progressData) {
    if (progressData) {
      const enhancedData = [];
      for (const data of progressData) {
        if (data.catalogId && data.topicId) {
          const course = await courseOps.getCourse(data.catalogId);
          const topic = course.allTopics.find((t) => t.id.replace(/-/g, '') === data.topicId.replace(/-/g, ''));

          enhancedData.push({
            ...data,
            topicTitle: topic ? topic.title : 'Unknown Topic',
          });
        }
      }
      return enhancedData;
    }

    return progressData;
  }

  function getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  return (
    <>
      <div className="flex-1 m-6 flex flex-col bg-white">
        {header}
        <main className="flex-1 overflow-auto p-2 border border-gray-200">
          <div>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Activities</p>
                    <p className="text-2xl font-semibold text-gray-900">{metrics.totalActivities.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Time</p>
                    <p className="text-2xl font-semibold text-gray-900">{Math.round(metrics.totalDuration / 60)} min</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Avg Session</p>
                    <p className="text-2xl font-semibold text-gray-900">{Math.round(metrics.averageDuration / 60)} min</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Activity Types</p>
                    <p className="text-2xl font-semibold text-gray-900">{Object.keys(metrics.activityTypes).length}</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Hourly Activity Trend */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Hourly Activity Trend</h3>
                <div className="h-80">
                  <Line data={hourlyActivityData} options={chartOptions} />
                </div>
              </div>

              {/* Daily Activity Trend */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Activity Trend</h3>
                <div className="h-80">
                  <Line data={dailyActivityData} options={chartOptions} />
                </div>
              </div>

              {metrics.totalActivities > 0 && (
                <>
                  {/* Activity Types Distribution */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Types Distribution</h3>
                    <div className="h-80">
                      <Doughnut data={activityTypesData} options={doughnutOptions} />
                    </div>
                  </div>

                  {/* Top Activities */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Learning Topics</h3>
                    <div className="h-80">
                      <Bar data={topTopicsData} options={barChartOptions} />
                    </div>
                  </div>

                  {/* Learning Insights */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Learning Insights</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                        <span className="text-sm font-medium text-blue-900">Most Active Day</span>
                        <span className="text-sm text-blue-700">{Object.keys(metrics.dailyActivity).reduce((a, b) => (metrics.dailyActivity[a] > metrics.dailyActivity[b] ? a : b)) || 'No data'}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                        <span className="text-sm font-medium text-green-900">Primary Activity Type</span>
                        <span className="text-sm text-green-700">{Object.keys(metrics.activityTypes).reduce((a, b) => (metrics.activityTypes[a] > metrics.activityTypes[b] ? a : b)) || 'No data'}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                        <span className="text-sm font-medium text-yellow-900">Weekly Average</span>
                        <span className="text-sm text-yellow-700">{Object.keys(metrics.weeklyActivity).length > 0 ? Math.round(Object.values(metrics.weeklyActivity).reduce((a, b) => a + b, 0) / Object.keys(metrics.weeklyActivity).length) : 0} activities</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                        <span className="text-sm font-medium text-purple-900">Learning Streak</span>
                        <span className="text-sm text-purple-700">{Object.keys(metrics.dailyActivity).length} days active</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
