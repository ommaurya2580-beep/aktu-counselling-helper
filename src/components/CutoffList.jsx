import React, { useState, useMemo } from 'react';
import Skeleton from './Skeleton.jsx';

const highlightText = (text, highlight) => {
    if (!highlight || !text) return text;
    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, index) => 
        regex.test(part) 
            ? <mark key={index} style={{ backgroundColor: 'rgba(59, 130, 246, 0.4)', color: '#fff', borderRadius: '2px', padding: '0 2px' }}>{part}</mark> 
            : part
    );
};

const CutoffList = ({ cutoffs, appliedFilters, isLoading }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [resultsPerPage, setResultsPerPage] = useState(20);
    const [maxResults, setMaxResults] = useState(500);
    const [copiedRank, setCopiedRank] = useState(null);

    const handleCopy = (rank) => {
        navigator.clipboard.writeText(rank);
        setCopiedRank(rank);
        setTimeout(() => setCopiedRank(null), 2000);
    };

    // Search & Filter logic
    const filteredData = useMemo(() => {
        let data = cutoffs;

        // External filters are now strictly handled by the parent component, so we only apply local search term
        if (!searchTerm) return data;
        
        const lowerSearch = searchTerm.toLowerCase();
        return data.filter(item =>
            item.institute?.toLowerCase().includes(lowerSearch) ||
            item.program?.toLowerCase().includes(lowerSearch) ||
            item.category?.toLowerCase().includes(lowerSearch) ||
            item.quota?.toLowerCase().includes(lowerSearch) ||
            item.gender?.toLowerCase().includes(lowerSearch)
        );
    }, [cutoffs, searchTerm]);

    // Apply Limit BEFORE Pagination
    const limitedResults = useMemo(() => {
        if (maxResults === "all") return filteredData;
        return filteredData.slice(0, maxResults);
    }, [filteredData, maxResults]);

    // Sort logic
    const sortedData = useMemo(() => {
        let sortableItems = [...limitedResults];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [limitedResults, sortConfig]);

    // Pagination logic
    const totalPages = Math.ceil(sortedData.length / resultsPerPage);
    const currentData = useMemo(() => {
        const start = (currentPage - 1) * resultsPerPage;
        return sortedData.slice(start, start + resultsPerPage);
    }, [sortedData, currentPage, resultsPerPage]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return '↕';
        return sortConfig.direction === 'asc' ? '▲' : '▼';
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                {/* Desktop Skeleton Table */}
                <div className="hidden md:block overflow-hidden rounded-[2rem] border border-white/10 glass-card">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/10">
                                {['Institute', 'Branch', 'Category', 'Quota', 'Gender', 'Opening', 'Closing'].map((h) => (
                                    <th key={h} className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {[...Array(8)].map((_, index) => (
                                <tr 
                                    key={index} 
                                    className="border-b border-white/5 hover:bg-white/5 transition-colors group animate-slideUp"
                                    style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'both' }}
                                >
                                    <td className="p-5"><Skeleton width="200px" height="16px" /></td>
                                    <td className="p-5"><Skeleton width="150px" height="16px" /></td>
                                    <td className="p-5"><Skeleton width="80px" height="16px" /></td>
                                    <td className="p-5"><Skeleton width="80px" height="16px" /></td>
                                    <td className="p-5"><Skeleton width="120px" height="16px" /></td>
                                    <td className="p-5"><Skeleton width="60px" height="16px" /></td>
                                    <td className="p-5"><Skeleton width="60px" height="16px" /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Skeleton Cards */}
                <div className="md:hidden space-y-4">
                    {[...Array(5)].map((_, index) => (
                        <div 
                            key={index} 
                            className="glass-card p-6 rounded-3xl border border-white/10 space-y-4 hover:border-indigo-500/30 transition-all group animate-slideUp"
                            style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                        >
                            <div className="space-y-2">
                                <Skeleton width="100%" height="20px" />
                                <Skeleton width="60%" height="16px" />
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <Skeleton width="80px" height="24px" rounded="full" />
                                <Skeleton width="100px" height="24px" rounded="lg" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!cutoffs || cutoffs.length === 0) {
        let title = "No Results Found";
        let message = "We couldn't find any cutoff data matching your selected filters.";
        let icon = "🔍";

        if (appliedFilters && appliedFilters.institute !== 'all' && appliedFilters.program !== 'all') {
            title = "Branch Not Available";
            message = "This specific branch is not offered by the selected college, or no data is available for this combination.";
            icon = "🚫";
        }
        
        return (
            <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-12 text-center shadow-2xl animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 bg-slate-950/50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/5 shadow-inner">
                    <span className="text-4xl">{icon}</span>
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">{title}</h3>
                <p className="text-slate-500 max-w-md mx-auto font-medium leading-relaxed">
                    {message}
                </p>
                <div className="mt-8 flex justify-center gap-4">
                    <button 
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all"
                    >
                        Adjust Filters
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-6 md:p-8 shadow-2xl space-y-8">
            {/* Header / Stats Section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="relative w-full lg:max-w-md group">
                    <input
                        type="text"
                        placeholder="Filter these results..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-5 py-4 pl-12 text-white font-bold outline-none ring-1 ring-white/5 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-slate-600 text-sm shadow-inner group-hover:border-white/20"
                    />
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 group-hover:scale-110 transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </span>
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1"
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                    <div className="flex items-center gap-3 bg-slate-950/30 px-4 py-2 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Show</span>
                        <select
                            value={resultsPerPage}
                            onChange={(e) => { setResultsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                            className="bg-transparent text-white font-bold outline-none cursor-pointer text-sm pr-2"
                        >
                            <option value={20} className="bg-slate-900">20</option>
                            <option value={50} className="bg-slate-900">50</option>
                            <option value={100} className="bg-slate-900">100</option>
                        </select>
                    </div>
                    
                    <div className="px-5 py-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                        <span className="text-indigo-200 font-bold text-sm">
                            {limitedResults.length.toLocaleString()} <span className="text-indigo-400/60 font-medium">matches found</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-hidden rounded-3xl border border-white/5 bg-slate-950/20 shadow-inner">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/5">
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">#</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => handleSort('round')}>
                                    Round {getSortIcon('round')}
                                </th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => handleSort('institute')}>
                                    Institute {getSortIcon('institute')}
                                </th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => handleSort('program')}>
                                    Specialization {getSortIcon('program')}
                                </th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Quota/Cat</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:text-indigo-400 transition-colors text-right" onClick={() => handleSort('opening_rank')}>
                                    Opening {getSortIcon('opening_rank')}
                                </th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:text-indigo-400 transition-colors text-right" onClick={() => handleSort('closing_rank')}>
                                    Closing {getSortIcon('closing_rank')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {currentData.length > 0 ? currentData.map((item, index) => (
                                <tr 
                                    key={item.id || index} 
                                    className="group hover:bg-white/[0.04] transition-all duration-300 animate-slideUp"
                                    style={{ animationDelay: `${index * 30}ms` }}
                                >
                                    <td className="px-6 py-5 text-slate-600 font-bold text-xs">{(currentPage - 1) * resultsPerPage + index + 1}</td>
                                    <td className="px-6 py-5">
                                        <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase tracking-wider">
                                            Round {item.round}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col gap-0.5 max-w-[320px]">
                                            <span className="text-white font-bold group-hover:text-indigo-300 transition-colors leading-tight">
                                                {highlightText(item.institute, searchTerm)}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{item.stream}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="text-slate-400 font-medium text-sm group-hover:text-slate-200 transition-colors">
                                            {highlightText(item.program, searchTerm)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-bold text-slate-300">{item.category}</span>
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{item.quota} • {item.gender}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right font-mono font-black text-indigo-400 text-sm">
                                        {item.opening_rank?.toLocaleString() || '-'}
                                    </td>
                                    <td className="px-6 py-5 text-right font-mono font-black text-purple-400 text-sm">
                                        <div className="flex items-center justify-end gap-2 group/rank relative">
                                            {item.closing_rank?.toLocaleString() || '-'}
                                            {item.closing_rank && (
                                                <div className="flex items-center gap-1.5">
                                                    {copiedRank === item.closing_rank && (
                                                        <span className="absolute -top-8 right-0 bg-indigo-500 text-white text-[9px] font-black px-2 py-1 rounded-lg animate-in fade-in slide-in-from-bottom-2 duration-300 whitespace-nowrap shadow-lg ring-1 ring-white/20 z-10">
                                                            COPIED!
                                                        </span>
                                                    )}
                                                    <button 
                                                        onClick={() => handleCopy(item.closing_rank)}
                                                        className="opacity-0 group-hover/rank:opacity-100 p-1.5 hover:bg-white/10 rounded-xl transition-all hover:scale-110 active:scale-90"
                                                        title="Copy Rank"
                                                    >
                                                        <svg className="w-3.5 h-3.5 text-slate-500 group-hover/rank:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="7" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <span className="text-4xl opacity-20">🔍</span>
                                            <p className="text-slate-500 font-medium">No results found matching your local search</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {currentData.length > 0 ? currentData.map((item, index) => (
                    <div 
                        key={item.id || index} 
                        className="bg-slate-950/40 border border-white/5 rounded-3xl p-5 space-y-4 relative overflow-hidden group active:scale-[0.98] transition-all animate-slideUp"
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-2xl rounded-full -mr-12 -mt-12"></div>
                        
                        <div className="flex items-start justify-between">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">R{item.round} • {item.stream}</span>
                                <h4 className="text-white font-bold text-base leading-tight pr-8">
                                    {highlightText(item.institute, searchTerm)}
                                </h4>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[9px] font-black text-slate-400 uppercase">{item.quota}</span>
                            </div>
                        </div>

                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                            <p className="text-slate-300 font-medium text-sm mb-3">
                                {highlightText(item.program, searchTerm)}
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Opening</span>
                                    <span className="text-white font-mono font-black">{item.opening_rank?.toLocaleString() || '-'}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Closing</span>
                                    <span className="text-indigo-400 font-mono font-black">{item.closing_rank?.toLocaleString() || '-'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{item.category}</span>
                            <span className="text-[10px] font-bold text-slate-500 capitalize">{item.gender?.toLowerCase()}</span>
                        </div>
                    </div>
                )) : (
                    <div className="py-12 text-center text-slate-500 italic">No search results found</div>
                )}
            </div>

            {/* Floating Pagination Bar */}
            {totalPages > 1 && (
                <div className="sticky bottom-24 md:bottom-12 left-0 right-0 z-30 flex justify-center px-4 animate-in slide-in-from-bottom-8 duration-700 delay-300">
                    <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-2 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-2 group ring-1 ring-white/5">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => { setCurrentPage(prev => prev - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed group/btn shadow-inner border border-white/5"
                        >
                            <span className="group-hover/btn:-translate-x-1 transition-transform text-xl">←</span>
                        </button>

                        <div className="px-8 min-w-[140px] text-center flex flex-col items-center justify-center">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-0.5">Step</span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-white font-black text-xl leading-none font-outfit">{currentPage}</span>
                                <span className="text-slate-700 font-bold text-sm">/</span>
                                <span className="text-slate-400 font-black text-sm">{totalPages}</span>
                            </div>
                        </div>

                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => { setCurrentPage(prev => prev + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            className="h-14 px-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 font-black text-[11px] uppercase tracking-[0.15em] text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 group/next border border-white/20"
                        >
                            <span className="flex items-center gap-3">
                                Advance
                                <span className="group-hover/next:translate-x-1 transition-transform text-xl">→</span>
                            </span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CutoffList;
