import React from 'react';
import '../../CSS/Analytics.css'; // Assuming you have some CSS for styling
import SummaryCards from './SummaryCards';
import { useState } from 'react';
import GraphsPanel from './GraphsPanel';
import RoadmapTimeline from './RoadmapTimeline';

interface AnalyticsProps {
    // Add your props here
}

type RangeKey = "3M" | "6M" | "1Y";

export const Analytics: React.FC<AnalyticsProps> = ({}) => {


    const [range, setRange] = useState<RangeKey>("3M");


    return (
        <div className="analytics-container">
            <h1 className="main-heading">Analytics</h1>

            <div className="secondpart-container">
                <div className="quick-add-container">
                    <SummaryCards range={range} onRangeChange={setRange} />
                </div>
        
                <div className="TransactionTable-container">
                    <div className='d-flex'>
                        <GraphsPanel range={range} />
                    </div>
                    
                   
                </div>
                
            </div>
            <div className="thirdpart-container p-4">
                    <h1 className='journey-progrss'>Journey Progress</h1>
                    <h3>How to become Financial independent ?</h3>
                    <RoadmapTimeline />
                </div>
        </div>
    );
};

export default Analytics;