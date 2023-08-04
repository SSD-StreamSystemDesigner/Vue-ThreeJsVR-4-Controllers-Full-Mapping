import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import GamepadView from "../views/GamepadView.vue"
import Cube from "../components/Cube.vue"


const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: GamepadView,
    },
    {
      path: "/home",
      name: "homefake",
      component: HomeView,
    },

    {
      path:"/cube",
      name:"cube",
      component: Cube,
    },
  ],
});

export default router;
