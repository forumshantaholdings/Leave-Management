
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserRole, RequestStatus, LeaveRequest, User, ApprovalStep } from './types';
import { APPROVAL_CHAINS, MOCK_USERS } from './constants';
import { analyzeLeaveReason } from './services/geminiService';
import { downloadRequestPDF } from './services/pdfService';
import { fetchUsersFromSheet, logRequestToCloud } from './services/sheetService';

// --- Helpers ---
const formatDateDisplay = (dateStr: string): string => {
  if (!dateStr) return '';
  const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parts = cleanDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

type Theme = 'light' | 'dark';

// --- Sub-components ---

const Navbar: React.FC<{ 
  currentUser: User; 
  onLogout: () => void; 
  onUpdateProfilePic: (data: string) => void;
  theme: Theme;
  onToggleTheme: () => void;
}> = ({ currentUser, onLogout, onUpdateProfilePic, theme, onToggleTheme }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdateProfilePic(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <nav className={`${theme === 'dark' ? 'bg-slate-950 border-white/5' : 'bg-white border-slate-200'} p-4 shadow-2xl border-b sticky top-0 z-50 transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto grid grid-cols-3 items-center">
        {/* Left: App Icon */}
        <div className="flex items-center space-x-3">
           <div className={`w-10 h-10 bg-[#8e8a1f] rounded-xl flex items-center justify-center shadow-lg shadow-[#8e8a1f]/20`}>
            <i className="fas fa-fingerprint text-white text-xl"></i>
          </div>
          <div className="hidden lg:block text-left">
            <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Secure</p>
            <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-white/50' : 'text-slate-400'} leading-none`}>Node 01</p>
          </div>
        </div>

        {/* Center: Brand Name */}
        <div className="text-center flex flex-col items-center">
          <span className={`font-black text-xl tracking-tight leading-none ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>SHANTA FORUM</span>
          <span className={`text-[9px] font-black uppercase tracking-[0.3em] mt-1.5 opacity-80 ${theme === 'dark' ? 'text-[#8e8a1f]' : 'text-[#8e8a1f]'}`}>Leave Management System</span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center justify-end space-x-3 md:space-x-5">
          <div className="text-right hidden sm:block">
            <p className={`text-sm font-black leading-none ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{currentUser.name}</p>
            <p className={`text-[10px] font-bold mt-1 uppercase tracking-wider text-[#8e8a1f]`}>{currentUser.role}</p>
          </div>
          
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className={`w-11 h-11 rounded-full border-2 overflow-hidden flex items-center justify-center transition-all shadow-inner group-hover:scale-105 duration-300 ${theme === 'dark' ? 'border-[#8e8a1f]/30 bg-slate-900' : 'border-[#8e8a1f]/30 bg-slate-50'}`}>
              {currentUser.profilePic ? (
                <img src={currentUser.profilePic} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className={`text-lg font-black ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{currentUser.name[0]}</span>
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 bg-[#8e8a1f] text-white w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[8px] shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
              <i className="fas fa-camera"></i>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          </div>

          <div className="flex items-center space-x-2">
            <button 
              onClick={onToggleTheme}
              className={`w-10 h-10 rounded-xl transition-all duration-300 border flex items-center justify-center ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10 text-amber-400' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-600'}`}
              title="Toggle Theme"
            >
              <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
            </button>

            <button 
              onClick={onLogout}
              className={`group w-10 h-10 rounded-xl transition-all duration-300 border flex items-center justify-center ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-rose-500/20 hover:border-rose-500/50 text-white/70 hover:text-rose-400' : 'bg-slate-100 border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-500 hover:text-rose-600'}`}
              title="Logout"
            >
              <i className="fas fa-power-off"></i>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

const ProgressBar: React.FC<{ request: LeaveRequest; theme: Theme }> = ({ request, theme }) => {
  return (
    <div className="w-full py-8 px-2">
      <div className="flex items-center justify-between relative">
        <div className={`absolute left-0 top-1/2 w-full h-1 rounded-full -z-10 -translate-y-1/2 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
        <div 
          className="absolute left-0 top-1/2 h-1 bg-[#8e8a1f] rounded-full -z-10 -translate-y-1/2 transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(142,138,31,0.4)]"
          style={{ width: `${(request.currentStepIndex / (request.approvalChain.length - 1 || 1)) * 100}%` }}
        ></div>
        {request.approvalChain.map((step, idx) => {
          const isCompleted = idx < request.currentStepIndex;
          const isCurrent = idx === request.currentStepIndex;
          const isRejected = step.status === 'rejected';
          return (
            <div key={idx} className="flex flex-col items-center group">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 shadow-sm ${
                isCompleted ? 'bg-[#8e8a1f] border-slate-100 text-white scale-90' : 
                isCurrent ? (theme === 'dark' ? 'bg-white border-[#8e8a1f] text-slate-900 ring-8 ring-[#8e8a1f]/10 scale-110' : 'bg-white border-[#8e8a1f] text-slate-900 ring-8 ring-slate-100 scale-110') : 
                isRejected ? 'bg-rose-600 border-rose-100 text-white' :
                (theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-600' : 'bg-white border-slate-200 text-slate-300')
              }`}>
                {isCompleted ? <i className="fas fa-check text-xs"></i> : 
                 isRejected ? <i className="fas fa-times text-xs"></i> :
                 <span className="text-[10px] font-black">{idx + 1}</span>}
              </div>
              <div className={`mt-3 flex flex-col items-center space-y-0.5`}>
                <span className={`text-[8px] font-black uppercase tracking-widest text-center px-2 py-0.5 rounded-md ${
                  isCurrent ? 'bg-[#8e8a1f]/10 text-[#8e8a1f]' : 'text-slate-400'
                }`}>
                  {step.role.split(' ')[0]}
                </span>
                {step.timestamp && (
                  <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">{formatDateDisplay(step.timestamp)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: RequestStatus; theme: Theme }> = ({ status, theme }) => {
  const baseStyles = theme === 'dark' ? 'ring-offset-slate-900' : 'ring-offset-white';
  const styles = {
    [RequestStatus.PENDING]: theme === 'dark' ? 'bg-amber-950/30 text-amber-400 border-amber-900 ring-amber-500/10' : 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-500/10',
    [RequestStatus.APPROVED]: theme === 'dark' ? 'bg-slate-800/40 text-slate-200 border-slate-700 ring-slate-500/10' : 'bg-slate-50 text-slate-700 border-slate-200 ring-slate-500/10',
    [RequestStatus.COMPLETED]: theme === 'dark' ? 'bg-[#8e8a1f]/10 text-[#8e8a1f] border-[#8e8a1f]/20 ring-[#8e8a1f]/10' : 'bg-[#8e8a1f]/10 text-[#8e8a1f] border-[#8e8a1f]/20 ring-[#8e8a1f]/10',
    [RequestStatus.REJECTED]: theme === 'dark' ? 'bg-rose-950/30 text-rose-400 border-rose-900 ring-rose-500/10' : 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/10',
  };
  return (
    <span className={`px-3 py-1 rounded-lg text-[9px] font-black border uppercase tracking-wider ring-4 ${styles[status]} ${baseStyles}`}>
      {status}
    </span>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pmSearchTerm, setPmSearchTerm] = useState('');
  const [pmStatusFilter, setPmStatusFilter] = useState<RequestStatus | 'ALL'>('ALL');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');

  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    relieverName: ''
  });

  const loadUsers = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const sheetUsers = await fetchUsersFromSheet();
      setAvailableUsers(sheetUsers);
    } catch (error: any) {
      console.error("Sync Error:", error.message);
      setSyncError(error.message || "Failed to fetch cloud database.");
      setAvailableUsers(MOCK_USERS);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const storedReqs = localStorage.getItem('leave_requests');
    if (storedReqs) setRequests(JSON.parse(storedReqs));
    
    const storedUser = localStorage.getItem('current_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setCurrentUser(parsedUser);
    }
    loadUsers();
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const saveRequests = (newRequests: LeaveRequest[]) => {
    setRequests(newRequests);
    localStorage.setItem('leave_requests', JSON.stringify(newRequests));
  };

  const handleUpdateProfilePic = (dataUrl: string) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, profilePic: dataUrl };
    setCurrentUser(updatedUser);
    localStorage.setItem('current_user', JSON.stringify(updatedUser));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('current_user');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const user = availableUsers.find(
      u => u.username?.toLowerCase().trim() === loginForm.username.toLowerCase().trim() && 
           u.password === loginForm.password
    );
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('current_user', JSON.stringify(user));
      setLoginForm({ username: '', password: '' });
    } else {
      setLoginError('Access denied. Authentication hash mismatch.');
    }
  };

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
    const diffTime = e.getTime() - s.getTime();
    return diffTime < 0 ? 0 : Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const leaveDays = useMemo(() => calculateDays(formData.startDate, formData.endDate), [formData.startDate, formData.endDate]);

  const approvedThisMonthCount = useMemo(() => {
    if (!currentUser) return 0;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return requests.reduce((count, req) => {
      if (req.status === RequestStatus.COMPLETED) {
        const lastStep = req.approvalChain[req.approvalChain.length - 1];
        if (lastStep?.timestamp) {
          const d = new Date(lastStep.timestamp);
          if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            if (currentUser.role === UserRole.PROJECT_MANAGER || req.userId === currentUser.id) return count + 1;
          }
        }
      }
      return count;
    }, 0);
  }, [requests, currentUser]);

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setLoading(true);
    const chainRoles = APPROVAL_CHAINS[currentUser.role] || [];
    await analyzeLeaveReason(formData.reason);
    const newRequest: LeaveRequest = {
      id: `REQ-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      userProfilePic: currentUser.profilePic,
      ...formData,
      leaveDays,
      status: RequestStatus.PENDING,
      currentStepIndex: 0,
      approvalChain: chainRoles.map(role => ({ role, status: 'pending' })),
      submittedAt: new Date().toISOString(),
    };
    saveRequests([newRequest, ...requests]);
    await logRequestToCloud(newRequest);
    setFormData({ startDate: '', endDate: '', reason: '', relieverName: '' });
    setShowSubmitModal(false);
    setLoading(false);
  };

  const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
    if (!currentUser) return;
    const newRequests: LeaveRequest[] = requests.map(req => {
      if (req.id !== requestId) return req;
      const updatedChain = [...req.approvalChain];
      const currentStep = updatedChain[req.currentStepIndex];
      const isRelieverAction = currentStep.role === UserRole.RELIEVER && req.relieverName === currentUser.name;
      const isRoleAction = currentStep.role === currentUser.role;
      if (!isRelieverAction && !isRoleAction) return req;
      if (action === 'reject') {
        return {
          ...req,
          status: RequestStatus.REJECTED,
          approvalChain: updatedChain.map((s, i) => i === req.currentStepIndex ? { ...s, status: 'rejected' as const, approverId: currentUser.id, timestamp: new Date().toISOString() } : s)
        };
      }
      const nextIdx = req.currentStepIndex + 1;
      const isDone = nextIdx === req.approvalChain.length;
      return {
        ...req,
        currentStepIndex: nextIdx,
        status: isDone ? RequestStatus.COMPLETED : RequestStatus.APPROVED,
        approvalChain: updatedChain.map((s, i) => i === req.currentStepIndex ? { ...s, status: 'approved' as const, approverId: currentUser.id, timestamp: new Date().toISOString() } : s)
      };
    });
    saveRequests(newRequests);
  };

  const myRequests = useMemo(() => requests.filter(r => r.userId === currentUser?.id), [requests, currentUser]);
  const pendingApprovals = useMemo(() => requests.filter(r => {
    if (r.status === RequestStatus.REJECTED || r.status === RequestStatus.COMPLETED) return false;
    const step = r.approvalChain[r.currentStepIndex];
    if (step?.role === UserRole.RELIEVER) return r.relieverName === currentUser?.name;
    return step?.role === currentUser?.role;
  }), [requests, currentUser]);

  const masterLedger = useMemo(() => {
    if (currentUser?.role !== UserRole.PROJECT_MANAGER) return [];
    return requests.filter(r => {
      const matchesSearch = r.userName.toLowerCase().includes(pmSearchTerm.toLowerCase()) || r.id.toLowerCase().includes(pmSearchTerm.toLowerCase());
      const matchesStatus = pmStatusFilter === 'ALL' || r.status === pmStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [requests, currentUser, pmSearchTerm, pmStatusFilter]);

  const relievers = useMemo(() => {
    if (!currentUser) return [];
    return availableUsers.filter(u => u.id !== currentUser.id);
  }, [availableUsers, currentUser]);

  const downloadLedgerCSV = () => {
    if (masterLedger.length === 0) return;
    const headers = ["ID", "Employee", "Role", "Start Date", "End Date", "Total Days", "Status", "Reason", "Proxy Agent", "Submitted At"];
    const rows = masterLedger.map(r => [r.id, r.userName, r.userRole, formatDateDisplay(r.startDate), formatDateDisplay(r.endDate), r.leaveDays, r.status, `"${r.reason.replace(/"/g, '""')}"`, r.relieverName, formatDateDisplay(r.submittedAt)]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Shanta_Forum_Leave_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!currentUser) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
        {/* Background Decorative Elements */}
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] transition-opacity duration-1000 ${theme === 'dark' ? 'bg-[#8e8a1f]/10' : 'bg-[#8e8a1f]/5'}`}></div>
        <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] transition-opacity duration-1000 ${theme === 'dark' ? 'bg-slate-700/10' : 'bg-slate-300/5'}`}></div>

        <div className={`max-w-md w-full backdrop-blur-xl rounded-[3rem] shadow-2xl p-12 border transition-all duration-500 relative z-10 text-center ${theme === 'dark' ? 'bg-slate-800/50 border-white/10' : 'bg-white border-slate-200'}`}>
          <div className="mb-10 flex flex-col items-center">
            <div className={`w-24 h-24 bg-[#8e8a1f] text-white rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl shadow-[#8e8a1f]/20 rotate-3 transition-transform hover:rotate-0 duration-500`}>
              <i className="fas fa-fingerprint text-4xl"></i>
            </div>
            <h1 className={`text-3xl font-black leading-tight tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>SHANTA FORUM</h1>
            <p className={`mt-2 font-black text-[10px] uppercase tracking-[0.4em] opacity-80 ${theme === 'dark' ? 'text-slate-400' : 'text-[#8e8a1f]'}`}>Leave Management System</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2 group">
              <label className={`text-[10px] font-black uppercase tracking-widest ml-1 text-left block transition-colors ${theme === 'dark' ? 'text-slate-400 group-focus-within:text-slate-300' : 'text-slate-500 group-focus-within:text-slate-800'}`}>Employee Handle</label>
              <div className="relative">
                <i className={`fas fa-id-card-clip absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${theme === 'dark' ? 'text-slate-500 group-focus-within:text-slate-300' : 'text-slate-400 group-focus-within:text-slate-800'}`}></i>
                <input 
                  type="text" required value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} placeholder="Username" 
                  className={`w-full border rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 transition-all ${theme === 'dark' ? 'bg-slate-950 border-white/5 text-white placeholder-slate-700 focus:ring-[#8e8a1f]/50 focus:border-[#8e8a1f]/50' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-[#8e8a1f]/20 focus:border-[#8e8a1f]/50'}`} 
                />
              </div>
            </div>
            <div className="space-y-2 group">
              <label className={`text-[10px] font-black uppercase tracking-widest ml-1 text-left block transition-colors ${theme === 'dark' ? 'text-slate-400 group-focus-within:text-slate-300' : 'text-slate-500 group-focus-within:text-slate-800'}`}>Authorization Key</label>
              <div className="relative">
                <i className={`fas fa-key absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${theme === 'dark' ? 'text-slate-500 group-focus-within:text-slate-300' : 'text-slate-400 group-focus-within:text-slate-800'}`}></i>
                <input 
                  type="password" required value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} placeholder="••••••••" 
                  className={`w-full border rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 transition-all ${theme === 'dark' ? 'bg-slate-950 border-white/5 text-white placeholder-slate-700 focus:ring-[#8e8a1f]/50 focus:border-[#8e8a1f]/50' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-[#8e8a1f]/20 focus:border-[#8e8a1f]/50'}`} 
                />
              </div>
            </div>
            {loginError && <div className="bg-rose-500/10 text-rose-500 p-4 rounded-2xl text-xs font-bold flex items-center space-x-3 border border-rose-500/20 text-left animate-shake"><i className="fas fa-shield-virus"></i><span>{loginError}</span></div>}
            <button type="submit" disabled={isSyncing} className="w-full bg-[#8e8a1f] hover:bg-[#747119] text-white font-black py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center space-x-3 transform hover:-translate-y-1 disabled:opacity-50 active:scale-95">
              {isSyncing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-unlock"></i>}
              <span>INITIALIZE SESSION</span>
            </button>
          </form>
          <div className="mt-10">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Global Registry Access • v2.4.0</p>
          </div>
        </div>
        
        {/* Theme toggle for login screen */}
        <button 
          onClick={toggleTheme}
          className={`absolute bottom-8 right-8 w-12 h-12 rounded-2xl border flex items-center justify-center transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 text-amber-400' : 'bg-white border-slate-200 text-slate-600 shadow-lg'}`}
        >
          <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Navbar 
        currentUser={currentUser} 
        onLogout={handleLogout} 
        onUpdateProfilePic={handleUpdateProfilePic} 
        theme={theme} 
        onToggleTheme={toggleTheme} 
      />
      
      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-10">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { label: 'MY FILINGS', value: myRequests.length, icon: 'fa-paper-plane' },
            { label: 'PENDING ACTION', value: pendingApprovals.length, icon: 'fa-bell' },
            { label: 'MONTHLY VERIFIED', value: approvedThisMonthCount, icon: 'fa-check-double' }
          ].map((kpi, idx) => (
            <div key={idx} className={`${theme === 'dark' ? 'bg-slate-900/50 border-white/5 hover:bg-slate-900' : 'bg-white border-slate-200/60 hover:shadow-xl'} p-8 rounded-[2rem] shadow-sm border flex items-center space-x-6 transition-all group duration-500`}>
              <div className={`p-5 rounded-2xl group-hover:scale-110 transition-transform ${theme === 'dark' ? 'bg-[#8e8a1f]/10 text-[#8e8a1f]' : `bg-[#8e8a1f]/10 text-[#8e8a1f]`}`}>
                <i className={`fas ${kpi.icon} text-2xl`}></i>
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{kpi.label}</p>
                <p className={`text-3xl font-black leading-none ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{kpi.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
          <div className="text-left">
            <h2 className="text-3xl font-black tracking-tight uppercase">Operational Desk</h2>
            <div className="flex items-center space-x-2 mt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-slate-500 font-black text-[10px] uppercase tracking-widest">Active System Connection</p>
            </div>
          </div>
          {(currentUser.role !== UserRole.PROJECT_MANAGER && currentUser.role !== UserRole.RELIEVER) && (
            <button onClick={() => setShowSubmitModal(true)} className="bg-[#8e8a1f] hover:bg-[#747119] text-white px-8 py-4 rounded-2xl font-black shadow-2xl transition-all flex items-center justify-center space-x-3 transform hover:-translate-y-1 active:scale-95">
              <i className="fas fa-plus"></i>
              <span>INITIATE FILING</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-12">
            
            {/* Master Node for PM */}
            {currentUser.role === UserRole.PROJECT_MANAGER && (
              <section className={`rounded-[3rem] p-1 shadow-2xl overflow-hidden border transition-colors duration-500 ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-200 border-slate-300'} group`}>
                <div className={`rounded-[2.8rem] p-10 relative ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
                  <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none transition-opacity duration-1000 group-hover:opacity-10"><i className="fas fa-network-wired text-[12rem] text-slate-400"></i></div>
                  
                  <div className="relative z-10 space-y-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 text-left">
                      <div>
                        <h4 className={`text-2xl font-black mb-2 flex items-center ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Master Administrative Node</h4>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Global System Ledger • Synchronized</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <button onClick={downloadLedgerCSV} className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition border ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-[#8e8a1f]/50' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`}>
                          <i className={`fas fa-file-csv mr-2 text-[#8e8a1f]`}></i> Export
                        </button>
                        <button onClick={loadUsers} className="bg-[#8e8a1f] hover:bg-[#747119] text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition shadow-lg">
                          <i className="fas fa-sync-alt mr-2"></i> Sync
                        </button>
                      </div>
                    </div>

                    <div className={`rounded-[2rem] p-8 border ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                      <div className={`flex flex-wrap items-center justify-between gap-6 mb-8 border-b pb-8 ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}`}>
                        <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Live Activity Feed</h5>
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="relative">
                            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 text-xs"></i>
                            <input 
                              type="text" placeholder="Identity Search..." value={pmSearchTerm} onChange={e => setPmSearchTerm(e.target.value)} 
                              className={`rounded-xl pl-11 pr-5 py-3 text-xs focus:outline-none transition-all w-52 ${theme === 'dark' ? 'bg-slate-950 border-white/5 text-white placeholder-slate-700 focus:border-[#8e8a1f]/50' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#8e8a1f]/50'}`} 
                            />
                          </div>
                          <select 
                            value={pmStatusFilter} onChange={e => setPmStatusFilter(e.target.value as any)}
                            className={`rounded-xl px-5 py-3 text-xs focus:outline-none focus:border-[#8e8a1f]/50 font-bold appearance-none cursor-pointer pr-10 relative transition-all ${theme === 'dark' ? 'bg-slate-950 border-white/5 text-slate-400' : 'bg-white border-slate-200 text-slate-600'}`}
                          >
                            <option value="ALL">Status: All</option>
                            <option value={RequestStatus.PENDING}>Status: Pending</option>
                            <option value={RequestStatus.APPROVED}>Status: Approved</option>
                            <option value={RequestStatus.REJECTED}>Status: Rejected</option>
                            <option value={RequestStatus.COMPLETED}>Status: Completed</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead><tr className={`border-b ${theme === 'dark' ? 'text-slate-600 border-white/5' : 'text-slate-400 border-slate-200'}`}><th className="pb-5 font-black uppercase tracking-widest">Reference ID</th><th className="pb-5 font-black uppercase tracking-widest">Associate</th><th className="pb-5 font-black uppercase tracking-widest">Interval</th><th className="pb-5 font-black uppercase tracking-widest">Status</th><th className="pb-5 font-black uppercase tracking-widest text-right">Certificate</th></tr></thead>
                          <tbody className={`divide-y ${theme === 'dark' ? 'divide-white/5' : 'divide-slate-100'}`}>
                            {masterLedger.length === 0 ? <tr><td colSpan={5} className="py-12 text-center text-slate-500 italic font-medium">No system records detected.</td></tr> : masterLedger.map(req => (
                              <tr key={req.id} className={`transition-all group cursor-default ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-100/50'}`}>
                                <td className={`py-6 font-mono font-black ${theme === 'dark' ? 'text-[#8e8a1f]' : 'text-[#8e8a1f]'}`}>{req.id}</td>
                                <td className="py-6 flex items-center space-x-4">
                                  <div className={`w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border shadow-inner group-hover:scale-105 transition-transform ${theme === 'dark' ? 'bg-slate-800 border-white/10' : 'bg-slate-200 border-white'}`}>
                                    {req.userProfilePic ? <img src={req.userProfilePic} className="w-full h-full object-cover" /> : <span className={`font-black text-[#8e8a1f]`}>{req.userName[0]}</span>}
                                  </div>
                                  <div><p className={`font-black ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{req.userName}</p><p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-0.5">{req.userRole}</p></div>
                                </td>
                                <td className="py-6"><p className={`font-black ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{formatDateDisplay(req.startDate)}</p><p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">{req.leaveDays} Business Days</p></td>
                                <td className="py-6"><StatusBadge status={req.status} theme={theme} /></td>
                                <td className="py-6 text-right"><button onClick={() => downloadRequestPDF(req)} className={`p-3 rounded-xl transition-all shadow-lg ${theme === 'dark' ? 'bg-slate-800 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-900 hover:text-white'}`}><i className="fas fa-file-pdf"></i></button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Review Queue */}
            <section className="space-y-6">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-6 flex items-center space-x-3 text-left"><span className={`w-8 h-px ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-300'}`}></span><i className="fas fa-stream text-[#8e8a1f]"></i><span>Review Pipeline</span></h3>
              <div className="grid grid-cols-1 gap-6">
                {pendingApprovals.length === 0 ? (
                  <div className={`border-2 border-dashed rounded-[2.5rem] p-16 text-center font-black flex flex-col items-center ${theme === 'dark' ? 'bg-slate-900/20 border-slate-800 text-slate-600' : 'bg-slate-100/50 border-slate-200 text-slate-400'}`}>
                    <i className="fas fa-check-circle text-4xl mb-4 opacity-30"></i>
                    PIPELINE CLEAR
                  </div>
                ) : pendingApprovals.map(req => (
                  <div key={req.id} className={`rounded-[2.5rem] shadow-sm border transition-all duration-500 overflow-hidden group ${theme === 'dark' ? 'bg-slate-900/40 border-white/5 hover:bg-slate-900/60' : 'bg-white border-slate-200 hover:shadow-2xl'}`}>
                    <div className="p-10 text-left">
                      <div className="flex flex-wrap justify-between items-start gap-6 mb-10">
                        <div className="flex items-center space-x-5">
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black overflow-hidden shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-500 ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}>
                            {req.userProfilePic ? <img src={req.userProfilePic} className="w-full h-full object-cover" /> : <span className={`text-xl text-[#8e8a1f]`}>{req.userName[0]}</span>}
                          </div>
                          <div><h4 className={`font-black text-2xl tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{req.userName}</h4><p className={`text-[10px] font-black uppercase tracking-[0.2em] mt-1 text-[#8e8a1f]`}>{req.userRole}</p></div>
                        </div>
                        <StatusBadge status={req.status} theme={theme} />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                        <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-slate-950/50 border-white/5' : 'bg-slate-50 border-slate-100'}`}><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Operational Window</p><p className={`text-sm font-black ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{formatDateDisplay(req.startDate)} — {formatDateDisplay(req.endDate)} <span className="text-[#8e8a1f] ml-2">({req.leaveDays}D)</span></p></div>
                        <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-slate-950/50 border-white/5' : 'bg-slate-50 border-slate-100'}`}><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Designated Proxy</p><p className={`text-sm font-black ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{req.relieverName}</p></div>
                      </div>

                      <div className="flex justify-end items-center space-x-6">
                        <button onClick={() => handleAction(req.id, 'reject')} className={`px-8 py-3.5 text-[11px] font-black uppercase tracking-widest rounded-2xl transition-colors ${theme === 'dark' ? 'text-rose-400 hover:bg-rose-500/10' : 'text-rose-600 hover:bg-rose-50'}`}>Decline Request</button>
                        <button onClick={() => handleAction(req.id, 'approve')} className="bg-[#8e8a1f] hover:bg-[#747119] text-white px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl transform hover:-translate-y-1 transition-all active:scale-95">Grant Authorization</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Personal History */}
            <section className="space-y-6">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-6 flex items-center space-x-3 text-left"><span className={`w-8 h-px ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-300'}`}></span><i className="fas fa-history text-[#8e8a1f]"></i><span>Archived Activity</span></h3>
              <div className="space-y-6">
                {myRequests.length === 0 ? (
                  <div className={`border-2 border-dashed rounded-[2.5rem] p-16 text-center font-black ${theme === 'dark' ? 'bg-slate-900/20 border-slate-800 text-slate-600' : 'bg-white border-slate-200 text-slate-400'}`}>NO ACTIVITY LOGGED</div>
                ) : myRequests.map(req => (
                  <div key={req.id} className={`rounded-[2.5rem] shadow-sm border p-10 transition-all duration-500 ${theme === 'dark' ? 'bg-slate-900/40 border-white/5 hover:bg-slate-900/60' : 'bg-white border-slate-200 hover:shadow-xl'}`}>
                    <div className="flex justify-between items-start mb-10 text-left">
                      <div>
                        <p className={`text-2xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{formatDateDisplay(req.startDate)} <span className="text-slate-500 font-light mx-2">/</span> {formatDateDisplay(req.endDate)}</p>
                        <p className={`text-[10px] font-black uppercase tracking-[0.3em] mt-2 text-[#8e8a1f]`}>REFERENCE: {req.id} • {req.leaveDays} DAYS</p>
                      </div>
                      <StatusBadge status={req.status} theme={theme} />
                    </div>
                    
                    <ProgressBar request={req} theme={theme} />
                    
                    <div className="flex justify-between items-center mt-10 pt-10 border-t border-slate-100/10">
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Filed {formatDateDisplay(req.submittedAt)}</p>
                      </div>
                      {req.status === RequestStatus.COMPLETED && (
                        <button onClick={() => downloadRequestPDF(req)} className={`text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-colors flex items-center ${theme === 'dark' ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                          <i className="fas fa-shield-check mr-2 text-[#8e8a1f]"></i> Download Verified Certificate
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar / Info */}
          <div className="space-y-10">
            {currentUser.role === UserRole.PROJECT_MANAGER && (
              <div className={`rounded-[3rem] p-12 shadow-2xl relative overflow-hidden text-left border group transition-all duration-500 ${theme === 'dark' ? 'bg-gradient-to-br from-slate-800 to-slate-950 border-white/10' : 'bg-gradient-to-br from-slate-800 to-slate-950 border-slate-600 text-white shadow-slate-900/10'}`}>
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-1000"><i className="fas fa-shield-halved text-7xl text-white"></i></div>
                <h4 className="text-2xl font-black mb-6 leading-tight text-white uppercase">Verification Protocol</h4>
                <p className="text-slate-100 text-sm font-medium opacity-80 mb-10 leading-relaxed">System-wide operational integrity is maintained through a mandatory multi-level acknowledgment protocol.</p>
                
                <div className="space-y-6 relative z-10">
                  {[
                    { step: '01', title: 'Reliever Acceptance', desc: 'Designated proxy must verify availability' },
                    { step: '02', title: 'Line Verification', desc: 'Chain of command authorizes request' },
                    { step: '03', title: 'Master Validation', desc: 'Final node verifies operational continuity' }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start space-x-5 group/item">
                      <div className="w-10 h-10 bg-[#8e8a1f]/30 rounded-xl flex items-center justify-center font-black text-xs text-white group-hover/item:bg-[#8e8a1f]/50 transition-colors shrink-0">{item.step}</div>
                      <div>
                        <p className="font-black text-xs uppercase tracking-widest mb-1 text-white">{item.title}</p>
                        <p className="text-[10px] text-slate-200 font-bold opacity-70 uppercase tracking-tighter">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={`rounded-[3rem] p-10 border shadow-sm text-left transition-colors duration-500 ${theme === 'dark' ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-200'}`}>
              <h5 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">System Health</h5>
              <div className="space-y-4">
                <div className={`flex justify-between items-center p-4 rounded-2xl ${theme === 'dark' ? 'bg-slate-950/50' : 'bg-slate-50'}`}><span className="text-[10px] font-black text-slate-500 uppercase">Cloud Sync</span><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span></div>
                <div className={`flex justify-between items-center p-4 rounded-2xl ${theme === 'dark' ? 'bg-slate-950/50' : 'bg-slate-50'}`}><span className="text-[10px] font-black text-slate-500 uppercase">Database</span><span className="text-[10px] font-black text-[#8e8a1f]">SECURE</span></div>
                <div className={`flex justify-between items-center p-4 rounded-2xl ${theme === 'dark' ? 'bg-slate-950/50' : 'bg-slate-50'}`}><span className="text-[10px] font-black text-slate-500 uppercase">Node Identity</span><span className="text-[10px] font-black text-slate-400">#{currentUser.id}</span></div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Submit Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
          <div className={`w-full max-w-xl rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.3)] overflow-hidden animate-in zoom-in-95 duration-300 text-left border ${theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}>
            <div className={`p-10 border-b flex justify-between items-center ${theme === 'dark' ? 'bg-slate-950/50 border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
              <div>
                <h3 className={`text-2xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>System Request</h3>
                <p className="text-[10px] font-black text-[#8e8a1f] uppercase tracking-[0.2em] mt-1.5">New Leave Application Submission</p>
              </div>
              <button onClick={() => setShowSubmitModal(false)} className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm hover:text-rose-500 transition-colors border ${theme === 'dark' ? 'bg-slate-800 text-slate-400 border-white/5' : 'bg-white text-slate-400 border-slate-200'}`}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <form onSubmit={handleSubmitLeave} className="p-12 space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Launch Date</label>
                  <input 
                    type="date" required value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} 
                    className={`w-full rounded-2xl px-6 py-4 font-black text-sm outline-none transition-all ${theme === 'dark' ? 'bg-slate-800 border-white/10 text-white focus:ring-4 focus:ring-[#8e8a1f]/10 focus:border-[#8e8a1f]/50 border' : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-4 focus:ring-[#8e8a1f]/10 focus:border-[#8e8a1f]/50 border'}`} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Return Date</label>
                  <input 
                    type="date" required value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} 
                    className={`w-full rounded-2xl px-6 py-4 font-black text-sm outline-none transition-all ${theme === 'dark' ? 'bg-slate-800 border-white/10 text-white focus:ring-4 focus:ring-[#8e8a1f]/10 focus:border-[#8e8a1f]/50 border' : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-4 focus:ring-[#8e8a1f]/10 focus:border-[#8e8a1f]/50 border'}`} 
                  />
                </div>
              </div>
              
              {leaveDays > 0 && (
                <div className="bg-[#8e8a1f] p-6 rounded-3xl flex items-center justify-between text-white shadow-xl transform animate-in slide-in-from-top-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.3em] opacity-80">Calculated Business Interval</span>
                  <span className="text-xl font-black">{leaveDays} DAYS</span>
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Assign Proxy Agent</label>
                <div className="relative">
                  <select 
                    required value={formData.relieverName} onChange={e => setFormData({...formData, relieverName: e.target.value})} 
                    className={`w-full rounded-2xl px-6 py-4 font-black text-sm appearance-none outline-none transition-all ${theme === 'dark' ? 'bg-slate-800 border-white/10 text-white focus:ring-4 focus:ring-[#8e8a1f]/10 focus:border-[#8e8a1f]/50 border' : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-4 focus:ring-[#8e8a1f]/10 focus:border-[#8e8a1f]/50 border'}`}
                  >
                    <option value="">Select Colleague...</option>
                    {relievers.map(r => <option key={r.id} value={r.name}>{r.name} — {r.role}</option>)}
                  </select>
                  <i className="fas fa-chevron-down absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Justification Analysis</label>
                <textarea 
                  required rows={4} value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} placeholder="Describe operational necessity..." 
                  className={`w-full rounded-2xl px-6 py-4 font-bold text-sm resize-none outline-none transition-all h-32 ${theme === 'dark' ? 'bg-slate-800 border-white/10 text-white focus:ring-4 focus:ring-[#8e8a1f]/10 focus:border-[#8e8a1f]/50 border' : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-4 focus:ring-[#8e8a1f]/10 focus:border-[#8e8a1f]/50 border'}`}
                ></textarea>
              </div>
              
              <button type="submit" disabled={loading || leaveDays <= 0} className="w-full bg-[#8e8a1f] hover:bg-[#747119] text-white font-black py-5 rounded-2xl shadow-2xl transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50">
                {loading ? <i className="fas fa-circle-notch fa-spin text-lg"></i> : 'SUBMIT AUTHORIZATION REQUEST'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
