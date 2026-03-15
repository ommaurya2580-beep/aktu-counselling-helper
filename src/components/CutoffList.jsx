import React, { useState, useMemo } from 'react';

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

const CutoffList = ({ cutoffs, filters }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

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
    }, [cutoffs, searchTerm, filters]);

    // Sort logic
    const sortedData = useMemo(() => {
        let sortableItems = [...filteredData];
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
    }, [filteredData, sortConfig]);

    // Pagination logic
    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const currentData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedData.slice(start, start + itemsPerPage);
    }, [sortedData, currentPage]);

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

    if (!cutoffs || cutoffs.length === 0) {
        return (
            <div className="glass-container" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>No cutoff data found for the selected filters.</p>
            </div>
        );
    }

    return (
        <div className="glass-container table-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <input
                    type="text"
                    placeholder="Search within results (Institute, Program, Category...)"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    style={{
                        padding: '0.75rem 1rem', width: '100%', maxWidth: '400px',
                        borderRadius: '8px', border: '1px solid var(--glass-border)',
                        background: 'var(--input-bg)', color: 'var(--text-primary)', outline: 'none'
                    }}
                />
                <div style={{ color: 'var(--text-primary)', fontWeight: '600', alignSelf: 'center', fontSize: '1.1rem' }}>
                    Showing {filteredData.length} cutoff results
                </div>
            </div>

            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('id')}>Sr No</th>
                            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('round')}>Round <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{getSortIcon('round')}</span></th>
                            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('institute')}>Institute <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{getSortIcon('institute')}</span></th>
                            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('program')}>Program <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{getSortIcon('program')}</span></th>
                            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('stream')}>Stream <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{getSortIcon('stream')}</span></th>
                            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('quota')}>Quota <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{getSortIcon('quota')}</span></th>
                            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('category')}>Category <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{getSortIcon('category')}</span></th>
                            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('gender')}>Seat Gender <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{getSortIcon('gender')}</span></th>
                            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('opening_rank')}>Opening Rank <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{getSortIcon('opening_rank')}</span></th>
                            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('closing_rank')}>Closing Rank <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{getSortIcon('closing_rank')}</span></th>
                            <th>Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentData.length > 0 ? currentData.map((item, index) => (
                            <tr key={item.id || index}>
                                <td style={{ color: 'var(--text-secondary)' }}>{(currentPage - 1) * itemsPerPage + index + 1}</td>
                                <td>{item.round}</td>
                                <td style={{ fontWeight: '500', color: 'var(--text-primary)', maxWidth: '250px' }}>{highlightText(item.institute, searchTerm)}</td>
                                <td style={{ maxWidth: '200px' }}>{highlightText(item.program, searchTerm)}</td>
                                <td><span className="tag">{highlightText(item.stream, searchTerm)}</span></td>
                                <td>{highlightText(item.quota, searchTerm)}</td>
                                <td><span className="tag category-tag">{highlightText(item.category, searchTerm)}</span></td>
                                <td>{item.gender}</td>
                                <td className="rank">{item.opening_rank?.toLocaleString() || '-'}</td>
                                <td className="rank">{item.closing_rank?.toLocaleString() || '-'}</td>
                                <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '150px' }}>{item.remarks || item.remark}</td>
                            </tr>
                        )) : (
                            <tr><td colSpan="11" style={{ textAlign: 'center', padding: '2rem' }}>No results match your search</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                        style={paginationBtnStyle(currentPage === 1)}
                    >
                        Prev
                    </button>

                    <span style={{ padding: '0.5rem 1rem', color: 'var(--text-primary)', alignSelf: 'center' }}>
                        Page {currentPage} of {totalPages}
                    </span>

                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        style={paginationBtnStyle(currentPage === totalPages)}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};

const paginationBtnStyle = (disabled) => ({
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    border: '1px solid var(--glass-border)',
    background: disabled ? 'rgba(255, 255, 255, 0.05)' : 'rgba(59, 130, 246, 0.2)',
    color: disabled ? 'var(--text-secondary)' : '#60a5fa',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'Outfit, sans-serif',
    fontWeight: '500',
    transition: 'all 0.2s ease',
});

export default CutoffList;
