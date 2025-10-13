import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);

export default function Metrics({ courseOps, setDisplayMetrics }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Helper function to validate custom date range
  const validateDateRange = () => {
    if (!startDate && !endDate) return true; // Allow empty dates
    if (startDate && endDate) {
      return new Date(startDate) <= new Date(endDate);
    }
    return true;
  };

  // Helper function to set common date ranges
  const setDatePreset = (preset) => {
    const today = new Date();
    const formatDate = (date) => date.toISOString().split('T')[0];

    switch (preset) {
      case 'today':
        setStartDate(formatDate(today));
        setEndDate(formatDate(today));
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        setStartDate(formatDate(yesterday));
        setEndDate(formatDate(yesterday));
        break;
      case 'thisWeek':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        setStartDate(formatDate(weekStart));
        setEndDate(formatDate(today));
        break;
      case 'thisMonth':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        setStartDate(formatDate(monthStart));
        setEndDate(formatDate(today));
        break;
      case 'clear':
        setStartDate('');
        setEndDate('');
        break;
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [startDate, endDate]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      // For now, we'll use null for courseId, enrollmentId, and userId to get all data
      // In a real implementation, you might want to filter by current user/course
      const metricsData = await getMetrics(null, null, null, startDate, endDate);
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
      return `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
    } else if (startDate) {
      return `From ${new Date(startDate).toLocaleDateString()}`;
    } else if (endDate) {
      return `Until ${new Date(endDate).toLocaleDateString()}`;
    } else {
      return 'All Time';
    }
  };

  const header = (
    <div className="mb-6 flex flex-col space-y-8">
      <div className="flex flex-col md:flex-row md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Learning Analytics Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            Showing data for: {getTimeRangeDescription(startDate, endDate)}
            {metrics && <span className="ml-2">({metrics.totalActivities} activities)</span>}
          </p>
        </div>
        <div className="flex flex-row mt-4 md:mt-0 space-y-0 space-x-2">
          <button onClick={loadMetrics} className="h-10 w-20 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm" title="Refresh metrics data">
            Refresh
          </button>
          <button onClick={() => setDisplayMetrics(false)} className="h-10 w-20 px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 text-sm" title="Close metrics dashboard">
            Close
          </button>
        </div>
      </div>
      {/* Date Range Inputs */}
      <div className="flex flex-col space-y-2">
        <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-2 md:items-center">
          <div className="flex items-center space-x-1">
            <label className="text-sm text-gray-600 w-10 md:w-auto">From:</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-sm" title="Start date (optional)" />
          </div>
          <div className="flex items-center space-x-1">
            <label className="text-sm text-gray-600 w-10 md:w-auto">To:</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-sm" title="End date (optional)" />
          </div>
        </div>
        {/* Quick date presets */}
        <div className="flex flex-wrap gap-1 text-xs">
          <button onClick={() => setDatePreset('today')} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700" title="Set to today">
            Today
          </button>
          <button onClick={() => setDatePreset('yesterday')} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700" title="Set to yesterday">
            Yesterday
          </button>
          <button onClick={() => setDatePreset('thisWeek')} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700" title="Set to this week">
            This Week
          </button>
          <button onClick={() => setDatePreset('thisMonth')} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700" title="Set to this month">
            This Month
          </button>
          <button onClick={() => setDatePreset('clear')} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700" title="Clear dates">
            Clear
          </button>
        </div>
        {!validateDateRange() && <span className="text-xs text-red-600">Start date must be before end date</span>}
        {!startDate && !endDate && <span className="text-xs text-gray-500">Leave empty for all time</span>}
      </div>
    </div>
  );

  if (metrics.totalActivities === 0) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        {header}
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-gray-400 text-6xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Activity Data</h3>
          <p className="text-gray-600 mb-4">No learning activities found for the selected time range: {getTimeRangeDescription(startDate, endDate)}</p>
          <p className="text-sm text-gray-500">Try selecting a different time range or check back later.</p>
        </div>
      </div>
    );
  }

  // Prepare data for charts
  const sortedDates = Object.keys(metrics.dailyActivity).sort();
  const dailyLabels = sortedDates; // Show all available data points

  const dailyActivityData = {
    labels: dailyLabels,
    datasets: [
      {
        label: 'Daily Activities',
        data: dailyLabels.map((date) => metrics.dailyActivity[date]),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
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

  const topActivitiesData = {
    labels: Object.keys(metrics.topActivities).slice(0, 10), // Top 10 activities
    datasets: [
      {
        label: 'Activity Count',
        data: Object.values(metrics.topActivities).slice(0, 10),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: `Activity Data`,
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
          maxTicksLimit: 10, // Reasonable number of ticks
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
    const progressData = await courseOps.getProgress(courseId, enrollmentId, userId);

    // Calculate the cutoff dates based on custom date inputs
    const now = new Date();
    const cutoffStartDate = startDate ? new Date(startDate) : new Date(0); // Beginning of time if no start date
    const cutoffEndDate = endDate ? new Date(endDate) : now; // Current time if no end date

    // Set end date to end of day
    cutoffEndDate.setHours(23, 59, 59, 999);

    // Filter progress data by time range
    const filteredProgressData = progressData.filter((activity) => {
      const activityDate = new Date(activity.createdAt);
      return activityDate >= cutoffStartDate && activityDate <= cutoffEndDate;
    }); // Process the filtered progress data to create metrics
    const metrics = {
      totalActivities: filteredProgressData.length,
      activityTypes: {},
      dailyActivity: {},
      weeklyActivity: {},
      averageDuration: 0,
      totalDuration: 0,
      topActivities: {},
      completionTrends: [],
    };

    let totalDurationSum = 0;
    let durationCount = 0;

    filteredProgressData.forEach((activity) => {
      // Activity types breakdown
      metrics.activityTypes[activity.type] = (metrics.activityTypes[activity.type] || 0) + 1;

      // Daily activity
      const date = new Date(activity.createdAt).toISOString().split('T')[0];
      metrics.dailyActivity[date] = (metrics.dailyActivity[date] || 0) + 1;

      // Weekly activity
      const week = getWeekNumber(new Date(activity.createdAt));
      metrics.weeklyActivity[week] = (metrics.weeklyActivity[week] || 0) + 1;

      // Duration calculations
      if (activity.duration > 0) {
        totalDurationSum += activity.duration;
        durationCount++;
      }
      metrics.totalDuration += activity.duration || 0;

      // Top activities by count
      metrics.topActivities[activity.activityId] = (metrics.topActivities[activity.activityId] || 0) + 1;
    });

    metrics.averageDuration = durationCount > 0 ? totalDurationSum / durationCount : 0;

    return metrics;
  }

  function getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {header}
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
        {/* Daily Activity Trend */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Activity Trend</h3>
          <div className="h-80">
            <Line data={dailyActivityData} options={chartOptions} />
          </div>
        </div>

        {/* Activity Types Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Types Distribution</h3>
          <div className="h-80">
            <Doughnut data={activityTypesData} options={doughnutOptions} />
          </div>
        </div>

        {/* Top Activities */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Learning Activities</h3>
          <div className="h-80">
            <Bar data={topActivitiesData} options={chartOptions} />
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
      </div>
    </div>
  );
}
