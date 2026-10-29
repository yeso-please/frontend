// 피그마에서 내보낸 SVG 아이콘. 색이 SVG에 박혀 있어 활성/비활성 색은 별도 파일이거나 color prop으로 덮어씁니다.
import Album from "@/assets/icons/icon-album.svg";
import AnalysisBackdrop from "@/assets/icons/analysis-backdrop-circle.svg";
import AnalysisRoute from "@/assets/icons/analysis-quiet-route.svg";
import ArrowRight from "@/assets/icons/icon-arrow-right.svg";
import Back from "@/assets/icons/icon-back.svg";
import Bell from "@/assets/icons/icon-bell.svg";
import Calendar18 from "@/assets/icons/icon-calendar-18.svg";
import CalendarSummary from "@/assets/icons/icon-calendar-summary.svg";
import CalendarSurvey from "@/assets/icons/icon-calendar-survey.svg";
import CalendarTask from "@/assets/icons/icon-calendar-task.svg";
import Camera from "@/assets/icons/icon-camera.svg";
import CheckExclusion from "@/assets/icons/icon-check-exclusion.svg";
import CheckFriend from "@/assets/icons/icon-check-friend.svg";
import CheckSelected from "@/assets/icons/icon-check-selected.svg";
import CheckTag from "@/assets/icons/icon-check-tag.svg";
import CheckTask from "@/assets/icons/icon-check-task.svg";
import Chevron18 from "@/assets/icons/icon-chevron-18.svg";
import ChevronRight from "@/assets/icons/icon-chevron-right.svg";
import ChevronRightBlue from "@/assets/icons/icon-chevron-right-blue.svg";
import ChevronUp from "@/assets/icons/icon-chevron-up.svg";
import Close from "@/assets/icons/icon-close.svg";
import Close20 from "@/assets/icons/icon-close-20.svg";
import Copy from "@/assets/icons/icon-copy.svg";
import CtaChevron from "@/assets/icons/icon-cta-chevron.svg";
import DiaryPinMap from "@/assets/icons/diary-pin-map.svg";
import Lock15 from "@/assets/icons/icon-lock-15.svg";
import LogoPin from "@/assets/icons/logo-pin.svg";
import MonthNext from "@/assets/icons/icon-month-next.svg";
import MonthPrev from "@/assets/icons/icon-month-prev.svg";
import MotiveCompanion from "@/assets/icons/motive-companion.svg";
import MotiveEscape from "@/assets/icons/motive-escape.svg";
import MotiveHistory from "@/assets/icons/motive-history.svg";
import MotiveNewExperience from "@/assets/icons/motive-new-experience.svg";
import MotiveRest from "@/assets/icons/motive-rest.svg";
import MotiveWellness from "@/assets/icons/motive-wellness.svg";
import NavHome from "@/assets/icons/icon-nav-home.svg";
import NavHomeActive from "@/assets/icons/icon-nav-home-active.svg";
import NavSave from "@/assets/icons/icon-nav-save.svg";
import NavSaveActive from "@/assets/icons/icon-nav-save-active.svg";
import NavTrip from "@/assets/icons/icon-nav-trip.svg";
import NavTripActive from "@/assets/icons/icon-nav-trip-active.svg";
import NavUser from "@/assets/icons/icon-nav-user.svg";
import NavUserActive from "@/assets/icons/icon-nav-user-active.svg";
import OnbBack from "@/assets/icons/onb-icon-back-arrow.svg";
import People from "@/assets/icons/icon-people.svg";
import PhotoAdd from "@/assets/icons/icon-photo-add.svg";
import Pin16 from "@/assets/icons/icon-pin-16.svg";
import PinBlue20 from "@/assets/icons/icon-pin-blue-20.svg";
import PinButton from "@/assets/icons/icon-pin-button.svg";
import PinDarkgreen20 from "@/assets/icons/icon-pin-darkgreen-20.svg";
import PinDestination from "@/assets/icons/pin-destination.svg";
import PinGreen16 from "@/assets/icons/icon-pin-16-green.svg";
import Refresh from "@/assets/icons/icon-refresh.svg";
import SelectedAreaGlow from "@/assets/icons/selected-area-glow.svg";
import Share from "@/assets/icons/icon-share.svg";
import Spark from "@/assets/icons/icon-spark.svg";
import Star14 from "@/assets/icons/icon-star-14.svg";
import Star14Empty from "@/assets/icons/icon-star-14-empty.svg";
import Star30 from "@/assets/icons/icon-star-30.svg";
import Star30Empty from "@/assets/icons/icon-star-30-empty.svg";

export const Icons = {
  Album,
  AnalysisBackdrop,
  AnalysisRoute,
  ArrowRight,
  Back,
  Bell,
  Calendar18,
  CalendarSummary,
  CalendarSurvey,
  CalendarTask,
  Camera,
  CheckExclusion,
  CheckFriend,
  CheckSelected,
  CheckTag,
  CheckTask,
  Chevron18,
  ChevronRight,
  ChevronRightBlue,
  ChevronUp,
  Close,
  Close20,
  Copy,
  CtaChevron,
  DiaryPinMap,
  Lock15,
  LogoPin,
  MonthNext,
  MonthPrev,
  MotiveCompanion,
  MotiveEscape,
  MotiveHistory,
  MotiveNewExperience,
  MotiveRest,
  MotiveWellness,
  NavHome,
  NavHomeActive,
  NavSave,
  NavSaveActive,
  NavTrip,
  NavTripActive,
  NavUser,
  NavUserActive,
  OnbBack,
  People,
  PhotoAdd,
  Pin16,
  PinBlue20,
  PinButton,
  PinDarkgreen20,
  PinDestination,
  PinGreen16,
  Refresh,
  SelectedAreaGlow,
  Share,
  Spark,
  Star14,
  Star14Empty,
  Star30,
  Star30Empty,
} as const;

export type IconName = keyof typeof Icons;
