import React, { useState, useRef, useEffect } from 'react';
import { FileText, Upload, File, X, CheckCircle, Trash2, Loader, AlertCircle, MessageCircle, Clock, RefreshCw, Download, ChevronRight, Ghost, ChevronLeft, AlertTriangle, Info, Lightbulb } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import UserProfile from '../components/UserProfile';
import DocumentInfoCard from '../components/DocumentInfoCard';
const apiUrl = import.meta.env.VITE_BACKEND_API;
interface UploadedPDF {
  id: string;
  uuid: string;
  name: string;
  size: number;
  size_mb: string;
  page_count: number;
  total_chunks: number;
  successful_chunks: string | number;
  indexing_status: 'completed' | 'failed' | 'processing';
  indexed_at?: string;
  uploaded_at?: string;
  cloudinary_url?: string;
  storage_type?: string;
}

const Dashboard = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadedPDF | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previousDocuments, setPreviousDocuments] = useState<UploadedPDF[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; document: UploadedPDF | null }>({ isOpen: false, document: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [infoModal, setInfoModal] = useState<{ isOpen: boolean; uuid: string | null }>({ isOpen: false, uuid: null });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/signin');
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Load previous documents on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadPreviousDocuments();
    }
  }, [isAuthenticated]);

  // Auto-hide toast after 5 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const loadPreviousDocuments = async () => {
    setLoadingDocs(true);
    try {
      const token = localStorage.getItem('chatdoc_token') || localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${apiUrl}/api/v1/pdf/list-pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.pdfs) {
          setPreviousDocuments(data.pdfs);
        }
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoadingDocs(false);
    }
  };



  const handleDeleteDocument = async (document: UploadedPDF) => {
    setDeleteModal({ isOpen: true, document });
  };

  const confirmDeleteDocument = async () => {
    if (!deleteModal.document) return;

    setIsDeleting(true);

    try {
      const token = localStorage.getItem('chatdoc_token') || localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(`${apiUrl}/api/v1/pdf/${deleteModal.document.uuid}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Remove document from UI immediately
          setPreviousDocuments(prev => prev.filter(doc => doc.uuid !== deleteModal.document!.uuid));
          showToast('Document deleted successfully', 'success');
          setDeleteModal({ isOpen: false, document: null });
        } else {
          throw new Error(data.message || 'Failed to delete document');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete document');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      showToast('Failed to delete document', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDeleteDocument = () => {
    setDeleteModal({ isOpen: false, document: null });
  };

  const handleShowInfo = (uuid: string) => {
    setInfoModal({ isOpen: true, uuid });
  };

  const handleCloseInfo = () => {
    setInfoModal({ isOpen: false, uuid: null });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    // Reset previous states
    setUploadResult(null);
    setUploadError(null);
    setUploadProgress(0);
    setIsProcessing(false);

    if (file.type !== 'application/pdf') {
      showToast('Please upload a PDF file only.', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      showToast('File size must be less than 10MB.', 'error');
      return;
    }

    setSelectedFile(file);
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    // Step 1: Start Upload
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setIsProcessing(false);

    try {
      const token = localStorage.getItem('chatdoc_token') || localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const formData = new FormData();
      formData.append('pdf', selectedFile);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      // Step 1: Upload PDF to Cloudinary + Embedding
      const response = await fetch(`${apiUrl}/api/v1/pdf/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);
      setIsUploading(false);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.pdf) {
          // Step 2: Start Processing Phase
          setIsProcessing(true);
          setUploadResult(data.pdf);

          // Check indexing status
          if (data.pdf.indexing_status === 'completed') {
            // Step 3: Success - Ready for Chat
            showToast('PDF uploaded to Cloudinary and embedded successfully!', 'success');

            // Auto-redirect to chat after 2-3 seconds
            setTimeout(() => {
              navigate(`/chat/${data.pdf.uuid}`);
            }, 2500);
          } else if (data.pdf.indexing_status === 'failed') {
            setUploadError('Failed to index PDF. Please try again.');
            showToast('Failed to index PDF. Please try again.', 'error');
            setIsProcessing(false);
          } else {
            // Still processing - show processing UI
            showToast('PDF uploaded to Cloudinary. Processing embeddings...', 'success');

            // Poll for completion (optional - you can implement this if needed)
            // For now, we'll show the processing state
          }

          // Refresh the documents list
          loadPreviousDocuments();
        } else {
          throw new Error(data.message || 'Upload failed');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

    } catch (error) {
      console.error('Upload failed:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed. Please try again.');
      showToast('Upload failed. Please try again.', 'error');
      setIsProcessing(false);
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setUploadError(null);
    setUploadProgress(0);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const retryUpload = () => {
    setUploadError(null);
    setUploadResult(null);
    setIsProcessing(false);
    handleFileUpload();
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleDownloadPDF = (cloudinaryUrl: string, fileName: string) => {
    // Open Cloudinary URL in new tab for download
    const link = document.createElement('a');
    link.href = cloudinaryUrl;
    link.target = '_blank';
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 280; // Card width + gap
      const currentScroll = carouselRef.current.scrollLeft;
      const targetScroll = direction === 'left'
        ? currentScroll - scrollAmount
        : currentScroll + scrollAmount;

      carouselRef.current.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Indexed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Processing
          </span>
        );
      default:
        return null;
    }
  };

  const getStorageBadge = (storageType: string) => {
    if (storageType === 'cloudinary') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
          ☁️ Cloudinary
        </span>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
          <div className="flex items-center space-x-2">
            {toast.type === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-white hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}


      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && deleteModal.document && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Delete Document
              </h3>

              <p className="text-gray-600 mb-6">
                Are you sure you want to delete "{deleteModal.document.name}"? This action cannot be undone and will permanently remove the document from your account.
              </p>

              <div className="flex space-x-3">
                <button
                  onClick={cancelDeleteDocument}
                  disabled={isDeleting}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteDocument}
                  disabled={isDeleting}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Info Modal */}
      <DocumentInfoCard
        uuid={infoModal.uuid || ''}
        isOpen={infoModal.isOpen}
        onClose={handleCloseInfo}
      />
      {/* Top Navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <Link to="/">

                <span className="text-2xl font-bold text-black">ChatDoc</span>
              </Link>
              <Link to="/" className="text-base font-medium text-gray-700 hover:text-blue-600 transition pl-8">
                Home
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <UserProfile />
            </div>
          </div>
        </div>
      </nav>

      {/* 1. Header Section */}
      <section className="bg-white py-12 pt-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-black mb-4">
            Welcome to Your Dashboard, <span className='animate-text bg-gradient-to-r from-[#1e3a8a] via-[#a5f3fc] to-[#1e3a8a] bg-[length:200%_200%] bg-clip-text text-transparent'>{user ? ` ${user.fullName.split(' ')[0]}` : ''}</span>
          </h1>
          <p className="text-xl text-gray-600">
            Upload PDFs and start asking questions instantly
          </p>
        </div>
      </section>

      {/* 2. Upload PDF Section */}
      <section className="bg-white py-4 ">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 bg-white rounded-xl p-14 shadow-lg border border-gray-200">
          <div className="max-w-4xl mx-auto">
            {!selectedFile ? (
              <div className="text-center pb-4">
                {/* <h2 className="text-3xl font-bold text-black mb-8 mt-0 pt-0">Upload Your PDF</h2> */}
                <div className="px-6 ">
                  {/* <Upload className="h-6 w-6 text-gray-600"/> */}
                  <h2 className="text-3xl font-bold text-black mb-8 mt-0">Upload Your PDF</h2>
                </div>

                {/* Drag and Drop Area */}
                <div
                  className={`border-2 border-dashed rounded-xl p-12 transition-all duration-200 cursor-pointer ${dragActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                    }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={openFileDialog}
                >
                  <div className="space-y-4">
                    <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                      <Upload className="h-8 w-8 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-gray-700 mb-2">
                        Drag & drop your PDF here
                      </p>
                      <p className="text-gray-500 mb-2">
                        .pdf only, up to 10MB
                      </p>
                      <p className="text-sm text-blue-600 font-medium">
                        ☁️ Securely stored in Cloudinary
                      </p>
                    </div>
                    {/* Browse Files Button */}
                    <button
                      onClick={openFileDialog}
                      className="bg-blue-600 text-white px-8 py-4 rounded-xl hover:bg-blue-700 transition-all duration-200 text-lg font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1 mb-8"
                    >
                      Browse Files
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto">
                <h2 className="text-3xl font-bold text-black mb-8 text-center">Upload Progress</h2>

                {/* File Preview */}
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="bg-red-100 p-3 rounded-lg">
                        <File className="h-6 w-6 text-red-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{selectedFile.name}</h3>
                        <p className="text-sm text-gray-500">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    {!isUploading && !uploadResult && !isProcessing && (
                      <button
                        onClick={resetUpload}
                        className="text-gray-400 hover:text-red-500 transition-colors duration-200"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {(isUploading || uploadResult || isProcessing) && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          {isUploading ? 'Uploading to Cloudinary...' :
                            isProcessing ? 'Processing Embeddings...' :
                              'Upload Complete'}
                        </span>
                        <span className="text-sm text-gray-500">
                          {isUploading ? `${uploadProgress}%` :
                            isProcessing ? 'Processing...' :
                              '100%'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${isProcessing ? 'bg-yellow-500 animate-pulse' :
                            uploadResult ? 'bg-green-500' : 'bg-blue-600'
                            }`}
                          style={{
                            width: isProcessing ? '100%' : `${uploadProgress}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Status Messages */}
                  {isUploading && (
                    <div className="flex items-center space-x-2 text-blue-600">
                      <Loader className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Uploading your PDF to Cloudinary...</span>
                    </div>
                  )}

                  {isProcessing && (
                    <div className="flex items-center space-x-2 text-yellow-600">
                      <Loader className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Analyzing and storing your document in vector database...</span>
                    </div>
                  )}

                  {uploadResult && uploadResult.indexing_status === 'completed' && !isProcessing && (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">Your PDF has been successfully uploaded and embedded!</span>
                      </div>

                      {/* Cloudinary Info */}
                      {uploadResult.cloudinary_url && (
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-blue-700 font-medium">☁️ Stored in Cloudinary</span>
                              {getStorageBadge(uploadResult.storage_type || 'cloudinary')}
                            </div>
                            <button
                              onClick={() => handleDownloadPDF(uploadResult.cloudinary_url!, uploadResult.name)}
                              className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                            >
                              <Download className="h-4 w-4" />
                              <span>Download PDF</span>
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex space-x-3">
                        {uploadResult.cloudinary_url && (
                          <button
                            onClick={() => handleDownloadPDF(uploadResult.cloudinary_url!, uploadResult.name)}
                            className="flex-1 bg-gray-600 text-white py-3 rounded-xl hover:bg-gray-700 transition-colors duration-200 font-semibold flex items-center justify-center space-x-2"
                          >
                            <Download className="h-4 w-4" />
                            <span>Download PDF</span>
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/chat/${uploadResult.uuid}`)}
                          className="flex-1 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition-colors duration-200 font-semibold flex items-center justify-center space-x-2"
                        >
                          <MessageCircle className="h-4 w-4" />
                          <span>Chat Now</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {uploadError && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-red-600">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">{uploadError}</span>
                      </div>
                      <button
                        onClick={retryUpload}
                        className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        <RefreshCw className="h-4 w-4" />
                        <span>Try Again</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                {!isUploading && !uploadResult && !uploadError && !isProcessing && (
                  <div className="text-center mt-8">
                    <button
                      onClick={handleFileUpload}
                      className="bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 transition-colors duration-200 font-semibold"
                    >
                      Upload to Cloudinary
                    </button>
                  </div>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      </section>


      {/* 3. Your Documents Section (Carousel) */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-black mb-2">Your Documents</h2>
            <p className="text-gray-600">Previously uploaded and indexed PDFs</p>
          </div>

          {loadingDocs ? (
            <div className="text-center py-12">
              <Loader className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-500">Loading documents...</p>
            </div>
          ) : previousDocuments.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-6">
                <Ghost className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No documents uploaded yet</h3>
              <p className="text-gray-500">
                Upload your first PDF to get started with AI-powered conversations
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Scroll Arrows for Large Screens */}
              {previousDocuments.length > 3 && (
                <>
                  <button
                    onClick={() => scrollCarousel('left')}
                    className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-white shadow-lg rounded-full p-3 hover:bg-gray-50 transition-colors duration-200"
                  >
                    <ChevronLeft className="h-6 w-6 text-gray-600" />
                  </button>
                  <button
                    onClick={() => scrollCarousel('right')}
                    className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-white shadow-lg rounded-full p-3 hover:bg-gray-50 transition-colors duration-200"
                  >
                    <ChevronRight className="h-6 w-6 text-gray-600" />
                  </button>
                </>
              )}

              {/* Horizontal Scroll Container */}
              <div
                ref={carouselRef}
                className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory touch-pan-x"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  //@ts-ignore
                  WebkitScrollbar: { display: 'none' }
                }}
              >
                {previousDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100 min-w-[280px] snap-start flex-shrink-0"
                  >
                    <div className="flex justify-end mb-2">
                      {/* Info Button */}
                      <button
                        onClick={() => handleShowInfo(doc.uuid)}
                        className="text-gray-400 hover:text-blue-500 transition-colors duration-200 p-1 rounded-full hover:bg-blue-50 pr-2"
                        title="View document info"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteDocument(doc)}
                        className="text-gray-400 hover:text-red-500 transition-colors duration-200 p-1 rounded-full hover:bg-red-50"
                        title="Delete document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {/* PDF Icon */}
                    <div className="bg-red-100 p-4 rounded-xl w-fit mx-auto mb-4">
                      <FileText className="h-8 w-8 text-red-600" />
                    </div>

                    {/* Document Info */}
                    <div className="text-center mb-4">
                      <h3 className="font-semibold text-gray-800 mb-2 truncate" title={doc.name}>
                        {doc.name}
                      </h3>
                      <div className="text-sm text-gray-500 space-y-1">
                        <p>{doc.size_mb} MB • {doc.page_count} pages</p>
                        <p>{doc.successful_chunks}/{doc.total_chunks} chunks</p>
                      </div>
                    </div>

                    {/* Status Badges */}
                    <div className="flex flex-wrap justify-center gap-2 mb-4">
                      {getStatusBadge(doc.indexing_status)}
                      {doc.storage_type && getStorageBadge(doc.storage_type)}
                    </div>

                    {/* Upload Date */}
                    {doc.indexed_at && (
                      <p className="text-xs text-gray-400 text-center mb-4">
                        {new Date(doc.indexed_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-2">
                      {doc.indexing_status === 'completed' ? (
                        <>
                          <button
                            onClick={() => navigate(`/chat/${doc.uuid}`)}
                            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium flex items-center justify-center space-x-2"
                          >
                            <MessageCircle className="h-4 w-4" />
                            <span>Chat</span>
                          </button>
                          {doc.cloudinary_url && (
                            <button
                              onClick={() => handleDownloadPDF(doc.cloudinary_url!, doc.name)}
                              className="w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 font-medium flex items-center justify-center space-x-2"
                            >
                              <Download className="h-4 w-4" />
                              <span>Download</span>
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          disabled
                          className="w-full bg-gray-300 text-gray-500 py-2 rounded-lg cursor-not-allowed font-medium"
                        >
                          Unavailable
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Refresh Button */}
              <div className="text-center mt-8">
                <button
                  onClick={loadPreviousDocuments}
                  className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors duration-200 font-medium"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Refresh Documents</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4. Upload Guidelines Section */}
      <section className="max-w-5xl mx-auto">
        <div className="bg-gradient-to-r from-grey-50 to-indigo-50 border border-grey-200 rounded-xl p-6 mb-8 shadow-lg">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-black mb-4 flex items-center">
                Upload Instructions
                <div className="ml-2 group relative">
                  <Info className="h-4 w-4 text-blue-500 cursor-help" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-white text-black text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                    Follow these guidelines for best results
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">File Type</p>
                      <p className="text-sm text-gray-600">Only PDF (.pdf) files are allowed</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">File Size Limit</p>
                      <p className="text-sm text-gray-600">Up to 10MB per file</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Avoid</p>
                      <p className="text-sm text-gray-600">Scanned or image-only PDFs</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Lightbulb className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Pro Tip</p>
                      <p className="text-sm text-gray-600">Ensure text is selectable for better AI responses</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-800 flex items-center">
                  <Info className="h-4 w-4 mr-1.5 flex-shrink-0" />
                  <span>Documents with clear, readable text provide the most accurate AI-powered conversations and insights.</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;