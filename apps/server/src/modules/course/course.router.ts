import { z } from "zod";
import {
	addLessonToCourse,
	createCourse,
	deleteCourse,
	getCourseById,
	listCourseLessons,
	listCourses,
	listPopularCourses,
	removeLessonFromCourse,
	reorderCourseLessons,
	setCourseAvailability,
	setCourseClassification,
	setCoursePublishState,
	updateCourse,
	updateCourseLesson,
} from "@/modules/course/course.service";
import {
	courseAdminAddLessonInputSchema,
	courseAdminByIdInputSchema,
	courseAdminCreateInputSchema,
	courseAdminDeleteInputSchema,
	courseAdminListInputSchema,
	courseAdminRemoveLessonInputSchema,
	courseAdminReorderLessonsInputSchema,
	courseAdminSetAvailabilityInputSchema,
	courseAdminSetClassificationInputSchema,
	courseAdminSetPublishStateInputSchema,
	courseAdminUpdateInputSchema,
	courseAdminUpdateLessonInputSchema,
	courseByIdInputSchema,
	courseClassificationOutputSchema,
	courseDeleteOutputSchema,
	courseDetailOutputSchema,
	courseLessonDeleteOutputSchema,
	courseLessonSchema,
	courseListInputSchema,
	courseListLessonsInputSchema,
	courseListOutputSchema,
	courseListPopularInputSchema,
	courseSchema,
} from "@/modules/course/course.validators";
import { adminProcedure, publicProcedure, router } from "@/orpc";

export const courseRouter = router({
	list: publicProcedure
		.route({
			method: "POST",
			path: "/rpc/course/list",
			tags: ["Course Public"],
			summary: "List Available Public Courses",
			description:
				"Public endpoint. Returns only courses that are both published and available.",
		})
		.input(courseListInputSchema.optional())
		.output(courseListOutputSchema)
		.handler(({ context, input }) => {
			const parsedInput = courseListInputSchema.parse(input ?? {});
			return listCourses({
				db: context.db,
				input: {
					...parsedInput,
					onlyPublished: true,
				},
			});
		}),
	getById: publicProcedure
		.route({
			method: "POST",
			path: "/rpc/course/getById",
			tags: ["Course Public"],
			summary: "Retrieve Available Public Course By ID",
			description:
				"Public endpoint. Returns course details only when it is both published and available.",
		})
		.input(courseByIdInputSchema)
		.output(courseDetailOutputSchema)
		.handler(({ context, input }) => {
			return getCourseById({
				db: context.db,
				input: {
					...input,
					onlyPublished: true,
				},
			});
		}),
	listPopular: publicProcedure
		.route({
			method: "POST",
			path: "/rpc/course/listPopular",
			tags: ["Course Public"],
			summary: "List Popular Public Courses",
			description:
				"Public endpoint. Returns popular courses that are currently published and available.",
		})
		.input(courseListPopularInputSchema.optional())
		.output(z.array(courseSchema))
		.handler(({ context, input }) => {
			return listPopularCourses({
				db: context.db,
				input: courseListPopularInputSchema.parse(input ?? {}),
			});
		}),
	listLessons: publicProcedure
		.route({
			method: "POST",
			path: "/rpc/course/listLessons",
			tags: ["Course Public"],
			summary: "List Public Course Lessons",
			description:
				"Public endpoint. Returns lessons visible for the requested published and available course.",
		})
		.input(courseListLessonsInputSchema)
		.output(z.array(courseLessonSchema))
		.handler(({ context, input }) => {
			return listCourseLessons({
				db: context.db,
				input,
				onlyPublished: true,
			});
		}),
	adminList: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/course/adminList",
			tags: ["Course Admin"],
			summary: "List Admin Courses",
			description:
				"Requires admin or superadmin role. Can return published, unpublished, available, or unavailable courses.",
		})
		.input(courseAdminListInputSchema.optional())
		.output(courseListOutputSchema)
		.handler(({ context, input }) => {
			return listCourses({
				db: context.db,
				input: courseAdminListInputSchema.parse(input ?? {}),
			});
		}),
	adminGetById: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/course/adminGetById",
			tags: ["Course Admin"],
			summary: "Retrieve Admin Course Details By ID",
			description:
				"Requires admin or superadmin role. Can include unpublished or unavailable course details.",
		})
		.input(courseAdminByIdInputSchema)
		.output(courseDetailOutputSchema)
		.handler(({ context, input }) => {
			return getCourseById({
				db: context.db,
				input,
			});
		}),
	adminCreate: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/course/adminCreate",
			tags: ["Course Admin"],
			summary: "Create Course",
			description:
				"Requires admin or superadmin role. Creates a new course container.",
		})
		.input(courseAdminCreateInputSchema)
		.output(courseSchema)
		.handler(({ context, input }) => {
			return createCourse({
				db: context.db,
				input,
				creatorId: context.session.user.id,
			});
		}),
	adminUpdate: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/course/adminUpdate",
			tags: ["Course Admin"],
			summary: "Update Course",
			description:
				"Requires admin or superadmin role. Updates mutable course fields.",
		})
		.input(courseAdminUpdateInputSchema)
		.output(courseSchema)
		.handler(({ context, input }) => {
			return updateCourse({
				db: context.db,
				input,
			});
		}),
	adminDelete: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/course/adminDelete",
			tags: ["Course Admin"],
			summary: "Delete Course",
			description:
				"Requires admin or superadmin role. Soft-deletes a course and returns deletion metadata.",
		})
		.input(courseAdminDeleteInputSchema)
		.output(courseDeleteOutputSchema)
		.handler(({ context, input }) => {
			return deleteCourse({
				db: context.db,
				input,
			});
		}),
	adminSetPublishState: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/course/adminSetPublishState",
			tags: ["Course Admin"],
			summary: "Set Course Publish State",
			description:
				"Requires admin or superadmin role. Sets whether a course is published.",
		})
		.input(courseAdminSetPublishStateInputSchema)
		.output(courseSchema)
		.handler(({ context, input }) => {
			return setCoursePublishState({
				db: context.db,
				input,
			});
		}),
	adminSetAvailability: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/course/adminSetAvailability",
			tags: ["Course Admin"],
			summary: "Set Course Availability State",
			description:
				"Requires admin or superadmin role. Sets whether a course is available.",
		})
		.input(courseAdminSetAvailabilityInputSchema)
		.output(courseSchema)
		.handler(({ context, input }) => {
			return setCourseAvailability({
				db: context.db,
				input,
			});
		}),
	adminSetClassification: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/course/adminSetClassification",
			tags: ["Course Admin"],
			summary: "Set Course Category Classification",
			description:
				"Requires admin or superadmin role. Updates category associations for a course.",
		})
		.input(courseAdminSetClassificationInputSchema)
		.output(courseClassificationOutputSchema)
		.handler(({ context, input }) => {
			return setCourseClassification({
				db: context.db,
				input,
			});
		}),
	adminAddLesson: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/course/adminAddLesson",
			tags: ["Course Admin"],
			summary: "Add Lesson To Course",
			description:
				"Requires admin or superadmin role. Adds a lesson directly to a course.",
		})
		.input(courseAdminAddLessonInputSchema)
		.output(courseLessonSchema)
		.handler(({ context, input }) => {
			return addLessonToCourse({
				db: context.db,
				input,
			});
		}),
	adminUpdateLesson: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/course/adminUpdateLesson",
			tags: ["Course Admin"],
			summary: "Update Course Lesson",
			description:
				"Requires admin or superadmin role. Updates mutable course lesson fields.",
		})
		.input(courseAdminUpdateLessonInputSchema)
		.output(courseLessonSchema)
		.handler(({ context, input }) => {
			return updateCourseLesson({
				db: context.db,
				input,
			});
		}),
	adminRemoveLesson: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/course/adminRemoveLesson",
			tags: ["Course Admin"],
			summary: "Remove Lesson From Course",
			description:
				"Requires admin or superadmin role. Removes a lesson from a course.",
		})
		.input(courseAdminRemoveLessonInputSchema)
		.output(courseLessonDeleteOutputSchema)
		.handler(({ context, input }) => {
			return removeLessonFromCourse({
				db: context.db,
				input,
			});
		}),
	adminReorderLessons: adminProcedure
		.route({
			method: "POST",
			path: "/rpc/course/adminReorderLessons",
			tags: ["Course Admin"],
			summary: "Reorder Course Lessons",
			description:
				"Requires admin or superadmin role. Reorders the full lesson set for a course.",
		})
		.input(courseAdminReorderLessonsInputSchema)
		.output(z.array(courseLessonSchema))
		.handler(({ context, input }) => {
			return reorderCourseLessons({
				db: context.db,
				input,
			});
		}),
});
