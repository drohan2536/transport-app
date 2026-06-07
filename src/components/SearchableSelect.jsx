import React, { useState, useEffect, useRef } from 'react';

export default function SearchableSelect({ options, value, onChange, placeholder = 'Search...', disabled = false, required = false }) {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    const selectedOption = options.find(o => String(o.id) === String(value));

    useEffect(() => {
        if (!isOpen) {
            setSearch('');
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(o => 
        o.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            <div 
                className={`form-input ${disabled ? 'disabled' : ''}`}
                style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    background: disabled ? 'var(--bg-tertiary)' : 'var(--bg-card)',
                    opacity: disabled ? 0.7 : 1,
                    minHeight: '40px'
                }}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                {selectedOption ? selectedOption.name : <span style={{ color: 'var(--text-muted)' }}>{placeholder}</span>}
                <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>▼</span>
            </div>
            {/* Hidden input for required validation */}
            {required && <input type="text" value={value || ''} style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }} required onChange={()=>{}} />}
            
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    marginTop: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    maxHeight: '250px',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <input 
                        type="text" 
                        value={search}
                        autoFocus
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Type to search..."
                        style={{
                            padding: '10px 12px',
                            border: 'none',
                            borderBottom: '1px solid var(--border-color)',
                            background: 'transparent',
                            color: 'var(--text-primary)',
                            outline: 'none',
                            width: '100%'
                        }}
                    />
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {filteredOptions.length === 0 ? (
                            <div style={{ padding: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>No matches</div>
                        ) : (
                            filteredOptions.map(option => (
                                <div 
                                    key={option.id}
                                    onClick={() => {
                                        onChange(option.id);
                                        setIsOpen(false);
                                    }}
                                    style={{
                                        padding: '10px 12px',
                                        cursor: 'pointer',
                                        background: String(value) === String(option.id) ? 'var(--bg-tertiary)' : 'transparent',
                                        color: 'var(--text-primary)'
                                    }}
                                    onMouseEnter={(e) => e.target.style.background = 'var(--bg-tertiary)'}
                                    onMouseLeave={(e) => e.target.style.background = String(value) === String(option.id) ? 'var(--bg-tertiary)' : 'transparent'}
                                >
                                    {option.name}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
