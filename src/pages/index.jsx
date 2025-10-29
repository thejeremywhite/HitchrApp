import Layout from "./Layout.jsx";

import Home from "./Home";

import Post from "./Post";

import Profile from "./Profile";

import Inbox from "./Inbox";

import Chat from "./Chat";

import AddressBook from "./AddressBook";

import PhoneSettings from "./PhoneSettings";

import NotificationsSettings from "./NotificationsSettings";

import BlockedUsers from "./BlockedUsers";

import admin from "./admin";

import DriverDetails from "./DriverDetails";

import RequestDetails from "./RequestDetails";

import Wallet from "./Wallet";

import DriverJob from "./DriverJob";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Home: Home,
    
    Post: Post,
    
    Profile: Profile,
    
    Inbox: Inbox,
    
    Chat: Chat,
    
    AddressBook: AddressBook,
    
    PhoneSettings: PhoneSettings,
    
    NotificationsSettings: NotificationsSettings,
    
    BlockedUsers: BlockedUsers,
    
    admin: admin,
    
    DriverDetails: DriverDetails,
    
    RequestDetails: RequestDetails,
    
    Wallet: Wallet,
    
    DriverJob: DriverJob,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Home />} />
                
                
                <Route path="/Home" element={<Home />} />
                
                <Route path="/Post" element={<Post />} />
                
                <Route path="/Profile" element={<Profile />} />
                
                <Route path="/Inbox" element={<Inbox />} />
                
                <Route path="/Chat" element={<Chat />} />
                
                <Route path="/AddressBook" element={<AddressBook />} />
                
                <Route path="/PhoneSettings" element={<PhoneSettings />} />
                
                <Route path="/NotificationsSettings" element={<NotificationsSettings />} />
                
                <Route path="/BlockedUsers" element={<BlockedUsers />} />
                
                <Route path="/admin" element={<admin />} />
                
                <Route path="/DriverDetails" element={<DriverDetails />} />
                
                <Route path="/RequestDetails" element={<RequestDetails />} />
                
                <Route path="/Wallet" element={<Wallet />} />
                
                <Route path="/DriverJob" element={<DriverJob />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}