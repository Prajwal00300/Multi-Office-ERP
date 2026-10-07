import React from 'react';
import { 
  TrendingUp, 
  Truck, 
  Clock, 
  Wallet, 
  CreditCard,
  AlertTriangle 
} from 'lucide-react';

const SuperAdminDashboard = () => {
  // Mock Data
  const kpiData = [
    { title: 'Total Tonnage', value: '45,230 MT', icon: TrendingUp, color: 'bg-blue-500', trend: '+12%' },
    { title: 'Total Dispatches', value: '1,204', icon: Truck, color: 'bg-green-500', trend: '+5%' },
    { title: 'Pending Payments', value: '₹12.4L', icon: Clock, color: 'bg-orange-500', trend: '-2%' },
    { title: 'Total Collections', value: '₹45.2L', icon: Wallet, color: 'bg-indigo-500', trend: '+18%' },
    { title: 'Total Expenses', value: '₹3.1L', icon: CreditCard, color: 'bg-rose-500', trend: '+1%' },
    { title: 'Active Red Flags', value: '5', icon: AlertTriangle, color: 'bg-red-600', trend: '+2' },
  ];

  const offices = [
    { id: 1, name: 'Office 1 (HQ)', dispatches: 845, collection: '₹32.1L', status: 'Active' },
    { id: 2, name: 'Office 2 (Branch)', dispatches: 359, collection: '₹13.1L', status: 'Active' },
  ];

  const redFlags = [
    { id: 1, type: 'Payment Mismatch', office: 'Office 1 (HQ)', ref: 'INV-2034', date: 'Oct 7, 2026', severity: 'High' },
    { id: 2, type: 'Weight Mismatch', office: 'Office 2 (Branch)', ref: 'GP-9421', date: 'Oct 7, 2026', severity: 'Medium' },
    { id: 3, type: 'Time Exceeded', office: 'Office 1 (HQ)', ref: 'GP-9400', date: 'Oct 6, 2026', severity: 'Low' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Overview</h2>
        <div className="text-sm text-gray-500">Last updated: Just now</div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiData.map((kpi, idx) => (
          <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center text-white ${kpi.color} mr-4`}>
              <kpi.icon size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{kpi.title}</p>
              <div className="flex items-baseline space-x-2">
                <h3 className="text-2xl font-bold text-gray-800">{kpi.value}</h3>
                <span className={`text-xs font-medium ${kpi.trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                  {kpi.trend}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Office-wise Overview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800">Office-wise Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-3 font-medium">Office</th>
                  <th className="px-6 py-3 font-medium">Dispatches</th>
                  <th className="px-6 py-3 font-medium">Collection</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {offices.map((office) => (
                  <tr key={office.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">{office.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{office.dispatches}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{office.collection}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {office.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Red Flags Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800">Recent Red Flags</h3>
            <span className="text-xs font-medium bg-red-100 text-red-600 px-2 py-1 rounded-full">Requires Action</span>
          </div>
          <div className="p-4 space-y-4">
            {redFlags.map((flag) => (
              <div key={flag.id} className="flex p-3 border border-red-100 bg-red-50/50 rounded-lg">
                <div className="mr-3 mt-0.5">
                  <AlertTriangle size={18} className="text-red-500" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-semibold text-gray-800">{flag.type}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      flag.severity === 'High' ? 'bg-red-200 text-red-700' : 'bg-orange-200 text-orange-700'
                    }`}>
                      {flag.severity}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{flag.office} • {flag.ref}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{flag.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
