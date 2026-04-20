import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, AlertCircle, Maximize2, X, Printer, Download, MoreVertical, Search, Info, ExternalLink, FolderPlus } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { getSupabaseProjectHeaders } from '../config/api';

const OfficePreview = ({ docId, fileName, driveFileId, previewStatus, isLoadingOuter = false, changedBlob = null, showChanges = false }) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showMoreActions, setShowMoreActions] = useState(false);
    const [changedDriveFileId, setChangedDriveFileId] = useState(null);
    const [uploadingChanged, setUploadingChanged] = useState(false);
    
    // Upload changed blob to Drive when showChanges is true
    useEffect(() => {
        if (showChanges && changedBlob && !uploadingChanged) {
            // Always re-upload when showChanges toggles on or changedBlob changes
            setChangedDriveFileId(null);
            uploadChangedToGoogleDrive();
        }
        
        // Cleanup: delete temporary file when showChanges becomes false
        return () => {
            if (changedDriveFileId && !showChanges) {
                deleteTemporaryFile(changedDriveFileId);
                setChangedDriveFileId(null);
            }
        };
    }, [showChanges, changedBlob]);
    
    const uploadChangedToGoogleDrive = async () => {
        setUploadingChanged(true);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            
            const formData = new FormData();
            formData.append('file', changedBlob, `preview_${fileName}`);
            
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/byod/upload-preview`, {
                method: 'POST',
                headers: {
                    ...getSupabaseProjectHeaders(),
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            if (response.ok) {
                const data = await response.json();
                setChangedDriveFileId(data.drive_file_id);
                console.log('Modified document uploaded to Drive:', data.drive_file_id);
            } else {
                const errorText = await response.text();
                console.error('Failed to upload preview:', errorText);
                // Reset showChanges if upload fails
                setChangedDriveFileId(null);
            }
        } catch (error) {
            console.error('Failed to upload changed document:', error);
            setChangedDriveFileId(null);
        } finally {
            setUploadingChanged(false);
        }
    };
    
    const deleteTemporaryFile = async (fileId) => {
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            
            await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/byod/preview/${fileId}`, {
                method: 'DELETE',
                headers: {
                    ...getSupabaseProjectHeaders(),
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (error) {
            console.error('Failed to delete temporary file:', error);
        }
    };
    
    const activeFileId = showChanges && changedDriveFileId ? changedDriveFileId : driveFileId;
    
    const previewUrl = useMemo(
        () => `https://drive.google.com/file/d/${activeFileId}/preview`,
        [activeFileId]
    );

    if (isLoadingOuter || previewStatus === 'pending' || uploadingChanged) {
         return (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#202124] bg-opacity-90 z-20 transition-opacity">
                 <Loader2 className="animate-spin text-slate-100 mb-2" size={32} />
                 <p className="text-sm font-medium text-slate-200">
                     {uploadingChanged ? "Uploading modified document to Drive..." : isLoadingOuter ? "Generating preview..." : "Uploading to Google Drive for preview..."}
                 </p>
             </div>
         );
    }
    
    if (previewStatus === 'not_configured') {
         return (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#202124] text-slate-200 gap-3 z-20">
                 <Info className="w-12 h-12 text-blue-400" />
                 <p className="font-semibold text-slate-100">Office Preview Not Available</p>
                 <p className="text-sm text-center max-w-sm text-slate-300">
                     Connect your Google Drive in Settings to enable Office document preview.
                 </p>
                 <p className="text-xs text-slate-400 mt-2">
                     You can still use Markdown preview mode.
                 </p>
             </div>
         );
    }
    
    if (previewStatus === 'error' || previewStatus === 'failed') {
         return (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#202124] text-slate-200 gap-3 z-20">
                 <AlertCircle className="w-12 h-12 text-rose-400" />
                 <p className="font-semibold text-slate-100">Preview not available.</p>
                 <p className="text-sm text-center max-w-sm text-slate-300">
                     Failed to upload to Google Drive. Please ensure you've connected your Google Drive account in Settings.
                 </p>
             </div>
         );
    }
    
    if (!driveFileId) {
         return (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#202124] text-slate-200 gap-3 z-20">
                 <AlertCircle className="w-12 h-12 text-rose-400" />
                 <p className="font-semibold text-slate-100">Preview not available.</p>
                 <p className="text-sm text-center max-w-sm text-slate-300">
                     Google Drive file ID is missing. The upload may still be in progress.
                 </p>
             </div>
         );
    }

    return (
        <div className="w-full h-full relative">
             <iframe 
                 src={previewUrl} 
                 className="w-full h-full border-0 absolute inset-0"
                 title="Google Docs Preview"
                 allow="autoplay"
             />
             <button
                 type="button"
                 onClick={() => setIsFullscreen(true)}
                 title="Full screen preview"
                 className="absolute top-3 left-3 z-20 inline-flex items-center justify-center w-9 h-9 rounded-full bg-black/60 text-slate-100 hover:bg-black/80 transition"
             >
                 <Maximize2 size={16} />
             </button>

            {isFullscreen && createPortal(
                <div className="fixed inset-0 z-9999 flex flex-col bg-black/70 backdrop-blur-xs">
                    {/* Header Bar */}
                    <div className="flex-none h-16 flex items-center justify-between px-4 bg-[#1e1f22]/10">
                        <div className="flex items-center gap-4 text-slate-100">
                            <button
                                type="button"
                                onClick={() => setIsFullscreen(false)}
                                title="Close"
                                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition"
                            >
                                <X size={20} />
                            </button>
                            <span className="text-base font-medium truncate max-w-[300px] md:max-w-md">{fileName || 'Document'}</span>
                        </div>
                        
                        <div className="flex items-center gap-1 sm:gap-3 text-slate-200">
                            <button type="button" className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition" title="Add to My Drive">
                                <FolderPlus size={20} />
                            </button>
                            <button 
                                type="button" 
                                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition" 
                                title="Print" 
                                onClick={() => {
                                    const fileId = showChanges && changedDriveFileId ? changedDriveFileId : driveFileId;
                                    window.open(`https://docs.google.com/document/d/${fileId}/export?format=pdf`, '_blank');
                                }}
                            >
                                <Printer size={20} />
                            </button>
                            <button 
                                type="button" 
                                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition" 
                                title="Download" 
                                onClick={() => {
                                    if (showChanges && changedBlob) {
                                        // Download the modified blob directly
                                        const url = URL.createObjectURL(changedBlob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `modified_${fileName}`;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                    } else {
                                        // Download original from Google Drive
                                        window.open(`https://docs.google.com/document/d/${driveFileId}/export?format=docx`);
                                    }
                                }}
                            >
                                <Download size={20} />
                            </button>
                            
                            <div className="relative">
                                <button 
                                    type="button" 
                                    onClick={() => setShowMoreActions(!showMoreActions)}
                                    className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition ml-1" 
                                    title="More actions"
                                >
                                    <MoreVertical size={20} />
                                </button>
                                
                                {showMoreActions && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowMoreActions(false)}></div>
                                        <div className="absolute right-0 mt-2 w-56 bg-white rounded shadow-lg py-1 text-sm text-slate-800 z-50">
                                            <button 
                                                className="w-full text-left px-4 py-2.5 hover:bg-slate-100 flex items-center gap-3"
                                                onClick={() => {
                                                    setShowMoreActions(false);
                                                    alert("To find text within the document, please click inside the document and press Ctrl+F (or Cmd+F on Mac) to use your browser's native search.");
                                                }}
                                            >
                                                <Search size={18} className="text-slate-500" />
                                                <span>Find</span>
                                            </button>
                                            <button className="w-full text-left px-4 py-2.5 hover:bg-slate-100 flex items-center gap-3">
                                                <Info size={18} className="text-slate-500" />
                                                <span>Details</span>
                                            </button>
                                            <div className="h-px bg-slate-200 my-1"></div>
                                            <button 
                                                className="w-full text-left px-4 py-2.5 hover:bg-slate-100 flex items-center gap-3" 
                                                onClick={() => { 
                                                    setShowMoreActions(false); 
                                                    const fileId = showChanges && changedDriveFileId ? changedDriveFileId : driveFileId;
                                                    window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank'); 
                                                }}
                                            >
                                                <ExternalLink size={18} className="text-slate-500" />
                                                <span>Open in new window</span>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 w-full relative flex justify-center items-center">
                        <div className="w-full h-full max-w-5xl bg-white shadow-2xl rounded-sm overflow-hidden relative">
                            <iframe
                                src={previewUrl}
                                className="w-full h-full border-0 absolute inset-0"
                                title="Google Docs Preview Fullscreen"
                                allow="autoplay"
                            />
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default OfficePreview;
