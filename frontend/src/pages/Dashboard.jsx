import EventList from "../components/EventList";

const Dashboard = ({ events, isLoading, onSelectEvent, onRefresh }) => {
  return (
    <div className="max-w-full h-full mr- px-0 sm:px-6 py-6">
      <EventList
        events={events}
        isLoading={isLoading}
        onSelectEvent={onSelectEvent}
        onRefresh={onRefresh}
      />
    </div>
  );
};

export default Dashboard;